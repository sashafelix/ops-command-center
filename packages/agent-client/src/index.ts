/**
 * @ops/agent-client
 *
 * Minimal TypeScript SDK for pushing agent activity into Ops Command Center.
 * Self-contained — depends only on Node 20+ (built-in fetch + crypto). Drop
 * this into any Node-based agent (Claude Code, a custom runner, a CI hook,
 * …) and call the methods at the right moments in the agent's lifecycle.
 *
 * Authentication: every call sends `Authorization: Bearer <token>`. Mint a
 * token in the dashboard under Settings → Tokens with the matching scopes:
 *
 *   - sessions.write     start / update / end
 *   - tool-calls.write   tool call records
 *   - approvals.write    approval requests
 *
 * Usage:
 *
 *   import { createAgent } from "@ops/agent-client";
 *
 *   const agent = createAgent({
 *     baseUrl: process.env.OPS_BASE_URL!,
 *     token: process.env.OPS_TOKEN!,
 *     agent_version: "claude-code/1.2.3",
 *     model: "sonnet-4.5",
 *     operator: "frank@example.com",
 *   });
 *
 *   const session = await agent.startSession({
 *     repo: "github.com/me/repo",
 *     goal: "Fix the auth middleware bug",
 *   });
 *
 *   await session.toolCall({ kind: "bash", name: "grep -r ..." });
 *   await session.toolCall({ kind: "edit_file", name: "auth.ts:42" });
 *   await session.update({ tokens_in: 12_000, tokens_out: 4_200 });
 *   await session.end({ outcome: "success" });
 */

import { randomUUID } from "node:crypto";

// =============================================================================
// Types
// =============================================================================

export type AgentClientConfig = {
  /** Base URL of the ops-command-center web app, e.g. https://ops.example.com */
  baseUrl: string;
  /** Bearer token minted in Settings → Tokens. */
  token: string;
  /** Agent identifier reported on every session, e.g. "claude-code/1.2.3". */
  agent_version: string;
  /** Model identifier, e.g. "sonnet-4.5". Can be overridden per-session. */
  model: string;
  /** Operator email or id reported on every session. */
  operator: string;
  /** Optional custom fetch implementation — useful for retries / metrics. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout in milliseconds. Default 10s. */
  timeoutMs?: number;
};

export type StartSessionInput = {
  /** Optional explicit id; auto-generated as `sess_<random>` if omitted. */
  id?: string;
  repo: string;
  goal: string;
  branch?: string;
  /** Override the client-level model for this session. */
  model?: string;
  /** Override the client-level operator. */
  operator?: string;
  /** ISO timestamp — defaults to now. */
  started_at?: string;
};

export type UpdateSessionInput = {
  runtime_s?: number;
  cost_usd?: number;
  tokens_in?: number;
  tokens_out?: number;
  tool_calls?: number;
  trust_score?: number;
  status?: "ok" | "warn" | "bad" | "idle";
  /** Human-readable "what's the agent doing now" line — shown on NOW PLAYING. */
  step?: string;
};

export type ToolCallInput = {
  /** Optional explicit id; auto-generated otherwise. */
  id?: string;
  kind: string;
  name: string;
  /** Milliseconds into the session — auto-tracked from startSession if omitted. */
  t_offset_ms?: number;
  cost_usd?: number;
  latency_ms?: number;
  note?: string;
  signed?: boolean;
  sig_key_id?: string;
};

export type EndSessionInput = {
  outcome: "success" | "aborted" | "failed";
  runtime_s?: number;
  cost_usd?: number;
  trust_score?: number;
};

export type ApprovalInput = {
  id?: string;
  severity: "low" | "med" | "high";
  policy_id: string;
  command: string;
  justification: string;
  blast_radius: string;
  /** Seconds before the request auto-denies. Default 5 min. */
  auto_deny_in_s?: number;
  action?: string;
  goal?: string;
  requires?: number;
  of?: number;
};

export class AgentClientError extends Error {
  // Plain field declarations rather than TS parameter-properties so the
  // SDK can be consumed by Node's type-stripping mode (>=22.6) without a
  // build step — that's how the claude-code-hook runs the .mjs entry.
  readonly status: number;
  readonly endpoint: string;
  readonly body: unknown;
  constructor(message: string, status: number, endpoint: string, body?: unknown) {
    super(message);
    this.name = "AgentClientError";
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }
}

// =============================================================================
// Client
// =============================================================================

export function createAgent(config: AgentClientConfig): AgentClient {
  return new AgentClient(config);
}

export class AgentClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly defaultAgent: string;
  private readonly defaultModel: string;
  private readonly defaultOperator: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(cfg: AgentClientConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, "");
    this.token = cfg.token;
    this.defaultAgent = cfg.agent_version;
    this.defaultModel = cfg.model;
    this.defaultOperator = cfg.operator;
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = cfg.timeoutMs ?? 10_000;
  }

  /**
   * Open a new session. Returns a SessionHandle that tracks the start time
   * so subsequent toolCall() calls can auto-fill `t_offset_ms`.
   */
  async startSession(input: StartSessionInput): Promise<SessionHandle> {
    const id = input.id ?? generateId("sess");
    const started_at = input.started_at ?? new Date().toISOString();
    await this.post("/api/ingest/session/start", {
      id,
      agent_version: this.defaultAgent,
      model: input.model ?? this.defaultModel,
      repo: input.repo,
      branch: input.branch,
      goal: input.goal,
      operator: input.operator ?? this.defaultOperator,
      started_at,
    });
    return new SessionHandle(this, id, Date.parse(started_at));
  }

  async updateSession(id: string, input: UpdateSessionInput): Promise<void> {
    await this.post("/api/ingest/session/update", { id, ...input });
  }

  async endSession(id: string, input: EndSessionInput): Promise<void> {
    await this.post("/api/ingest/session/end", { id, ...input });
  }

  async toolCall(
    session_id: string,
    input: ToolCallInput,
    startedAtMs: number,
  ): Promise<{ id: string }> {
    const id = input.id ?? generateId("tc", 16);
    const t_offset_ms = input.t_offset_ms ?? Math.max(0, Date.now() - startedAtMs);
    await this.post("/api/ingest/tool-call", {
      id,
      session_id,
      t_offset_ms,
      kind: input.kind,
      name: input.name,
      cost_usd: input.cost_usd ?? 0,
      latency_ms: input.latency_ms ?? 0,
      note: input.note,
      signed: input.signed ?? false,
      sig_key_id: input.sig_key_id,
    });
    return { id };
  }

  async requestApproval(session_id: string, input: ApprovalInput): Promise<{ id: string }> {
    const id = input.id ?? generateId("apr");
    await this.post("/api/ingest/approval", {
      id,
      session_id,
      severity: input.severity,
      policy_id: input.policy_id,
      command: input.command,
      justification: input.justification,
      blast_radius: input.blast_radius,
      auto_deny_in_s: input.auto_deny_in_s ?? 60 * 5,
      action: input.action,
      goal: input.goal,
      requires: input.requires ?? 1,
      of: input.of ?? 1,
    });
    return { id };
  }

  private async post(path: string, body: Record<string, unknown>): Promise<void> {
    const url = `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          // Close the socket immediately after the response so short-lived
          // consumers (e.g. the Claude Code hook, where each event spawns
          // a fresh process) don't leave undici keep-alive sockets behind.
          // Without this, Node 25 on Windows aborts with a libuv
          // UV_HANDLE_CLOSING assertion during teardown.
          connection: "close",
        },
        body: JSON.stringify(stripUndefined(body)),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AgentClientError(`fetch failed: ${msg}`, 0, path);
    }
    if (!res.ok) {
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        parsed = await res.text().catch(() => null);
      }
      throw new AgentClientError(
        `${path} → HTTP ${res.status}`,
        res.status,
        path,
        parsed,
      );
    }
  }
}

/**
 * Handle returned by startSession — knows its own id + start time so
 * tool-call offsets and runtime can be tracked automatically.
 */
export class SessionHandle {
  readonly id: string;
  private readonly client: AgentClient;
  private readonly startedAtMs: number;

  constructor(client: AgentClient, id: string, startedAtMs: number) {
    this.client = client;
    this.id = id;
    this.startedAtMs = startedAtMs;
  }

  toolCall(input: ToolCallInput): Promise<{ id: string }> {
    return this.client.toolCall(this.id, input, this.startedAtMs);
  }

  update(input: UpdateSessionInput): Promise<void> {
    return this.client.updateSession(this.id, input);
  }

  requestApproval(input: ApprovalInput): Promise<{ id: string }> {
    return this.client.requestApproval(this.id, input);
  }

  /**
   * Close out the session. Auto-fills runtime_s from the local start time
   * if the caller didn't supply one.
   */
  end(input: EndSessionInput): Promise<void> {
    const runtime_s = input.runtime_s ?? Math.max(0, Math.floor((Date.now() - this.startedAtMs) / 1000));
    return this.client.endSession(this.id, { ...input, runtime_s });
  }

  /** Wall-clock elapsed seconds since the session started. */
  elapsedSeconds(): number {
    return Math.max(0, Math.floor((Date.now() - this.startedAtMs) / 1000));
  }
}

// =============================================================================
// Utilities
// =============================================================================

function generateId(prefix: string, length = 12): string {
  const slug = randomUUID().replace(/-/g, "").slice(0, length);
  return `${prefix}_${slug}`;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}
