#!/usr/bin/env node
/**
 * Claude Code → Ops Command Center bridge.
 *
 * Configure as a Claude Code hook (in ~/.claude/settings.json or the
 * project's .claude/settings.json) and every session you run lights up
 * Live / Sessions / Audit on the dashboard.
 *
 * Hook contract: Claude Code spawns this script per event, passes the
 * event payload on stdin as JSON, and ignores stdout (or surfaces it
 * for debugging). We map the event to one or more /api/ingest/* calls
 * via @ops/agent-client.
 *
 * Cross-event state (tool start time, session id) lives in a small
 * directory keyed by Claude Code's session_id. Each hook invocation
 * is a fresh process — the state file is how PostToolUse computes
 * latency from a PreToolUse that happened seconds earlier.
 *
 * Env:
 *   OPS_BASE_URL       (default http://localhost:3000)
 *   OPS_TOKEN          (required — mint in Settings → Tokens with
 *                       sessions.write + tool-calls.write scopes)
 *   OPS_OPERATOR       (default $USER or "claude-code")
 *   OPS_MODEL          (default sonnet-4.5)
 *   OPS_AGENT_VERSION  (default claude-code)
 *   OPS_HOOK_DEBUG=1   prints what the hook would post + responses
 *   OPS_HOOK_STATE_DIR (default $TMPDIR/ops-claude-hook or /tmp/...)
 *
 * Failures are swallowed — a flaky network call must never break the
 * Claude Code session.
 */

import { createAgent, AgentClientError } from "@ops/agent-client";
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

// ----- Config ---------------------------------------------------------------

const BASE_URL = process.env.OPS_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.OPS_TOKEN ?? "";
const OPERATOR = process.env.OPS_OPERATOR ?? process.env.USER ?? "claude-code";
const MODEL = process.env.OPS_MODEL ?? "sonnet-4.5";
const AGENT_VERSION = process.env.OPS_AGENT_VERSION ?? "claude-code";
const DEBUG = process.env.OPS_HOOK_DEBUG === "1";
const STATE_DIR = process.env.OPS_HOOK_STATE_DIR ?? join(tmpdir(), "ops-claude-hook");

// If no token is set, exit silently — operator hasn't finished setup.
// Don't break their Claude Code session.
if (!TOKEN) {
  if (DEBUG) console.error("[ops-hook] OPS_TOKEN not set — skipping");
  process.exit(0);
}

mkdirSync(STATE_DIR, { recursive: true });

/**
 * Stdlib node:http fetch shim, agent-less. We bypass undici because its
 * keep-alive socket pool triggers a libuv UV_HANDLE_CLOSING assertion on
 * Node 25 / Windows when a short-lived script (like this hook) exits
 * mid-pool-cleanup. node:http + agent:false closes the socket on response
 * end, so process exit is clean and the hook returns 0.
 *
 * Only implements what @ops/agent-client uses (POST with bearer + JSON,
 * AbortSignal, a .ok/.status/.json/.text/.headers response surface).
 */
function nodeHttpFetch(input, init = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(typeof input === "string" ? input : input.toString());
    const lib = u.protocol === "https:" ? https : http;
    const headers = { ...(init.headers ?? {}) };
    if (init.body != null) {
      headers["content-length"] = Buffer.byteLength(init.body);
    }
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method: init.method ?? "GET",
        headers,
        agent: false, // explicit: no keep-alive pool
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const text = buf.toString("utf8");
          resolve({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            headers: res.headers,
            text: () => Promise.resolve(text),
            json: () => Promise.resolve(text ? JSON.parse(text) : null),
          });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    if (init.signal) {
      const onAbort = () => req.destroy(new Error("aborted"));
      if (init.signal.aborted) onAbort();
      else init.signal.addEventListener("abort", onAbort, { once: true });
    }
    if (init.body != null) req.write(init.body);
    req.end();
  });
}

const agent = createAgent({
  baseUrl: BASE_URL,
  token: TOKEN,
  agent_version: AGENT_VERSION,
  model: MODEL,
  operator: OPERATOR,
  fetchImpl: nodeHttpFetch,
});

// ----- Read event payload from stdin ---------------------------------------

const raw = await readStdin();
let event;
try {
  event = JSON.parse(raw);
} catch (err) {
  if (DEBUG) console.error("[ops-hook] bad stdin JSON:", err?.message ?? err);
  process.exit(0);
}

const sessionId = String(event.session_id ?? "");
if (!sessionId) {
  if (DEBUG) console.error("[ops-hook] event missing session_id; skipping");
  process.exit(0);
}

const eventName = String(event.hook_event_name ?? "");
const statePath = join(STATE_DIR, `${sanitize(sessionId)}.json`);
const state = loadState(statePath);

try {
  switch (eventName) {
    case "SessionStart":
      await onSessionStart(event, state, statePath);
      break;
    case "PreToolUse":
      onPreToolUse(event, state, statePath);
      break;
    case "PostToolUse":
      await onPostToolUse(event, state, statePath);
      break;
    case "UserPromptSubmit":
      await onUserPromptSubmit(event, state, statePath);
      break;
    case "Stop":
    case "SessionEnd":
      await onSessionEnd(event, state, statePath);
      break;
    default:
      if (DEBUG) console.error(`[ops-hook] unknown event: ${eventName}`);
  }
} catch (err) {
  if (err instanceof AgentClientError) {
    if (DEBUG) console.error(`[ops-hook] ${err.endpoint} → ${err.status} ${err.message}`);
  } else if (DEBUG) {
    console.error(`[ops-hook] crash:`, err?.message ?? err);
  }
}
// Always exit clean — hooks must not block Claude Code.
process.exit(0);

// ----- Event handlers ------------------------------------------------------

async function onSessionStart(event, state, statePath) {
  // Idempotent: if we've already opened this session, skip.
  if (state.opened) return;
  const cwd = String(event.cwd ?? process.cwd());
  const repo = guessRepo(cwd);
  // Claude Code doesn't pass an explicit goal — use the first prompt
  // once UserPromptSubmit fires. Open with a placeholder for now.
  const goal = `claude-code session in ${repo}`;
  await agent.startSession({
    id: sessionId,
    repo,
    goal,
    operator: OPERATOR,
  });
  state.opened = true;
  state.startedAt = Date.now();
  state.cwd = cwd;
  state.repo = repo;
  state.toolCalls = 0;
  saveState(statePath, state);
  if (DEBUG) console.error(`[ops-hook] session.start ${sessionId} (${repo})`);
}

function onPreToolUse(event, state, statePath) {
  // Record the tool's start time keyed by tool_use_id so PostToolUse
  // can compute latency. Don't post anything here — POST happens on Post.
  const toolUseId = String(event.tool_use_id ?? `${event.tool_name}:${Date.now()}`);
  state.toolStarts = state.toolStarts ?? {};
  state.toolStarts[toolUseId] = Date.now();
  saveState(statePath, state);
}

async function onPostToolUse(event, state, statePath) {
  // Open the session lazily if SessionStart was missed (some Claude Code
  // versions fire PreToolUse before SessionStart on a fresh worktree).
  await ensureSessionOpen(event, state);

  const toolUseId = String(event.tool_use_id ?? "");
  const startedAt = state.toolStarts?.[toolUseId];
  const latencyMs = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
  if (state.toolStarts && toolUseId) delete state.toolStarts[toolUseId];

  const name = derivToolName(event);
  await agent.toolCall(
    sessionId,
    {
      kind: String(event.tool_name ?? "tool"),
      name,
      latency_ms: latencyMs,
    },
    state.startedAt ?? Date.now(),
  );
  state.toolCalls = (state.toolCalls ?? 0) + 1;
  state.lastStep = `${event.tool_name} · ${truncate(name, 80)}`;
  // Persist BEFORE the session.update — if the update fails, the next
  // PostToolUse still has the right count to send.
  saveState(statePath, state);
  await agent.updateSession(sessionId, {
    tool_calls: state.toolCalls,
    runtime_s: state.startedAt
      ? Math.floor((Date.now() - state.startedAt) / 1000)
      : undefined,
    step: state.lastStep,
  });
  if (DEBUG) console.error(`[ops-hook] tool ${event.tool_name} · ${latencyMs}ms`);
}

async function onUserPromptSubmit(event, state, statePath) {
  await ensureSessionOpen(event, state);
  const prompt = truncate(String(event.prompt ?? "").trim(), 200);
  if (!prompt) return;
  state.lastStep = `prompt · ${prompt}`;
  saveState(statePath, state);
  await agent.updateSession(sessionId, { step: state.lastStep });
}

async function onSessionEnd(event, state, statePath) {
  if (!state.opened) return; // never properly opened
  await agent.endSession(sessionId, {
    outcome: "success",
    runtime_s: state.startedAt
      ? Math.floor((Date.now() - state.startedAt) / 1000)
      : undefined,
  });
  // Clean up the state file — session is done.
  try {
    unlinkSync(statePath);
  } catch {
    /* ok if already gone */
  }
  if (DEBUG) console.error(`[ops-hook] session.end ${sessionId}`);
}

// ----- Helpers --------------------------------------------------------------

async function ensureSessionOpen(event, state) {
  if (state.opened) return;
  const cwd = String(event.cwd ?? process.cwd());
  const repo = guessRepo(cwd);
  await agent.startSession({
    id: sessionId,
    repo,
    goal: `claude-code session in ${repo}`,
    operator: OPERATOR,
  });
  state.opened = true;
  state.startedAt = state.startedAt ?? Date.now();
  state.repo = repo;
  state.cwd = cwd;
  state.toolCalls = state.toolCalls ?? 0;
}

function derivToolName(event) {
  // Try to extract a useful label from tool_input for common tools.
  const input = event.tool_input ?? {};
  switch (event.tool_name) {
    case "Bash":
      return String(input.command ?? "bash").trim();
    case "Edit":
    case "Write":
      return String(input.file_path ?? "file").trim();
    case "Read":
      return String(input.file_path ?? "file").trim();
    case "Grep":
      return String(input.pattern ?? "grep").trim();
    case "Glob":
      return String(input.pattern ?? "glob").trim();
    default: {
      const first = Object.values(input)[0];
      return typeof first === "string" ? first : String(event.tool_name ?? "tool");
    }
  }
}

function guessRepo(cwd) {
  // Cheap heuristic — use the last two path segments. Good enough for
  // a label; the operator can rename via Sessions later if it matters.
  const parts = cwd.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length >= 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : cwd;
}

function loadState(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function saveState(path, state) {
  try {
    writeFileSync(path, JSON.stringify(state), { mode: 0o600 });
  } catch (err) {
    if (DEBUG) console.error("[ops-hook] state write failed:", err?.message ?? err);
  }
}

function sanitize(id) {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 96);
}

function truncate(s, max) {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

async function readStdin() {
  return await new Promise((resolve) => {
    let data = "";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      // Detach stdin from libuv before resolving so it can't trigger a
      // UV_HANDLE_CLOSING assertion on Node 25 / Windows when the
      // surrounding async work finishes and the process tries to exit.
      try {
        process.stdin.pause();
        process.stdin.removeAllListeners();
        process.stdin.destroy?.();
      } catch {
        /* best-effort cleanup */
      }
      resolve(data);
    };
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", finish);
    process.stdin.on("error", finish);
    const watchdog = setTimeout(finish, 2_000);
    watchdog.unref?.();
  });
}
