/**
 * Demo agent runner.
 *
 * Pretends to be a Claude Code-style agent: starts sessions, fires
 * realistic tool-call traffic, and ends them. Pushes everything through
 * @ops/agent-client. Pure simulation — no LLM, no real edits — but the
 * data flowing into ops-command-center is real.
 *
 * Run:
 *   OPS_BASE_URL=http://localhost:3000 \
 *   OPS_TOKEN=ops_live_... \
 *   pnpm -F @ops/demo-agent start
 *
 * Token: mint under Settings → Tokens with sessions.write,
 * tool-calls.write, approvals.write scopes.
 */

import { createAgent, AgentClientError, type SessionHandle } from "@ops/agent-client";

const BASE_URL = process.env.OPS_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.OPS_TOKEN ?? "";
const OPERATOR = process.env.OPS_OPERATOR ?? "demo-agent@ops";
const MODEL = process.env.OPS_MODEL ?? "sonnet-4.5";
const AGENT_VERSION = process.env.OPS_AGENT_VERSION ?? "claude-code/0.0.0-demo";

if (!TOKEN) {
  console.error("[demo-agent] OPS_TOKEN is not set — mint a token in Settings → Tokens");
  process.exit(1);
}

const agent = createAgent({
  baseUrl: BASE_URL,
  token: TOKEN,
  agent_version: AGENT_VERSION,
  model: MODEL,
  operator: OPERATOR,
});

const GOALS: Array<{ goal: string; repo: string; branch: string; steps: Step[] }> = [
  {
    goal: "Fix the typo in apps/web/src/lib/utils.ts",
    repo: "github.com/anthropic-ops/ops-command-center",
    branch: "fix/utils-typo",
    steps: [
      { kind: "bash", name: "grep -rn 'recieve' apps/", cost: 0.001, latency: 120 },
      { kind: "read_file", name: "apps/web/src/lib/utils.ts:42", cost: 0.002, latency: 80 },
      { kind: "edit_file", name: "apps/web/src/lib/utils.ts:42", cost: 0.004, latency: 60 },
      { kind: "bash", name: "pnpm -F @ops/web typecheck", cost: 0.001, latency: 5_200 },
      { kind: "bash", name: "git commit -m 'fix: typo'", cost: 0.001, latency: 180 },
    ],
  },
  {
    goal: "Investigate Proxmox sync latency in apps/realtime",
    repo: "github.com/anthropic-ops/ops-command-center",
    branch: "main",
    steps: [
      { kind: "bash", name: "docker compose logs realtime --tail=200", cost: 0.001, latency: 320 },
      { kind: "grep", name: "proxmox sync", cost: 0.001, latency: 150 },
      { kind: "read_file", name: "apps/realtime/src/sync-tick.ts", cost: 0.003, latency: 90 },
      { kind: "read_file", name: "apps/web/src/server/connectors/proxmox.ts", cost: 0.004, latency: 110 },
      { kind: "summarize", name: "tick latency root cause", cost: 0.012, latency: 1_400 },
    ],
  },
  {
    goal: "Add a JSONL export endpoint for audit events",
    repo: "github.com/anthropic-ops/ops-command-center",
    branch: "feat/audit-export-jsonl",
    steps: [
      { kind: "read_file", name: "apps/web/src/server/routers/audit-log.ts", cost: 0.003, latency: 80 },
      { kind: "edit_file", name: "apps/web/src/server/routers/audit-log.ts +export", cost: 0.008, latency: 220 },
      { kind: "edit_file", name: "apps/web/src/app/.../audit-log-view.tsx", cost: 0.006, latency: 180 },
      { kind: "bash", name: "pnpm -F @ops/web typecheck", cost: 0.001, latency: 5_400 },
      { kind: "bash", name: "pnpm -F @ops/web test", cost: 0.001, latency: 4_100 },
    ],
  },
  {
    goal: "Bump n8n webhook retry budget",
    repo: "github.com/anthropic-ops/ops-command-center",
    branch: "fix/webhook-retry",
    steps: [
      { kind: "grep", name: "MAX_ATTEMPTS", cost: 0.001, latency: 110 },
      { kind: "read_file", name: "apps/realtime/src/webhook-tick.ts", cost: 0.002, latency: 70 },
      { kind: "edit_file", name: "MAX_ATTEMPTS 5 → 7", cost: 0.003, latency: 60 },
    ],
  },
];

type Step = { kind: string; name: string; cost: number; latency: number };

async function runOne(spec: (typeof GOALS)[number]): Promise<void> {
  let session: SessionHandle | null = null;
  try {
    session = await agent.startSession({
      repo: spec.repo,
      goal: spec.goal,
      branch: spec.branch,
    });
    log(`▶ ${session.id}  ${spec.goal}`);

    let tokensIn = 0;
    let tokensOut = 0;
    let cost = 0;
    let toolCalls = 0;

    await session.update({ step: "warming up…", tokens_in: 1_200, tokens_out: 400 });
    await sleep(rand(800, 1600));

    for (const step of spec.steps) {
      await session.update({ step: `${step.kind} · ${step.name}` });
      await session.toolCall({
        kind: step.kind,
        name: step.name,
        cost_usd: step.cost,
        latency_ms: step.latency,
      });
      toolCalls += 1;
      tokensIn += rand(400, 2_000);
      tokensOut += rand(200, 1_000);
      cost += step.cost;
      await session.update({
        tool_calls: toolCalls,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_usd: roundCents(cost),
        runtime_s: session.elapsedSeconds(),
      });
      // Real time between tool calls so the operator sees progress live.
      await sleep(Math.min(step.latency, 1_500) + rand(300, 900));
    }

    await session.update({ step: "wrapping up…" });
    await sleep(rand(400, 800));
    await session.end({
      outcome: "success",
      cost_usd: roundCents(cost),
      trust_score: 0.92 + Math.random() * 0.07,
    });
    log(`✓ ${session.id}  finished · $${cost.toFixed(3)} · ${toolCalls} tool calls`);
  } catch (err: unknown) {
    if (err instanceof AgentClientError) {
      log(`✗ ${session?.id ?? "?"}  ${err.status} ${err.endpoint} — ${err.message}`);
    } else {
      log(`✗ ${session?.id ?? "?"}  unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

async function loop(): Promise<void> {
  log(`[demo-agent] pushing to ${BASE_URL} as ${OPERATOR}`);
  // Run two sessions concurrently so Live shows something happening, with
  // staggered starts to make the timing readable.
  let i = 0;
  while (true) {
    const a = GOALS[i % GOALS.length]!;
    const b = GOALS[(i + 1) % GOALS.length]!;
    void runOne(a);
    await sleep(2_500);
    void runOne(b);
    // Wait for both to plausibly finish before kicking the next pair.
    await sleep(40_000);
    i += 2;
  }
}

void loop();

// =============================================================================
// helpers
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rand(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

function roundCents(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function log(line: string): void {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`${t}  ${line}`);
}
