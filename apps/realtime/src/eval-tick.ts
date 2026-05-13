/**
 * Eval run worker.
 *
 * apps/web's evals.runSuite mutation inserts an `eval_runs` row with
 * status='queued' and pg_notify's 'eval_run_pending'. This worker claims
 * those rows, marks them 'running', iterates over the suite's enabled
 * cases, calls the configured model for each prompt, scores the response
 * against `expected_pattern` (regex), and writes per-case results into
 * eval_case_results. Aggregates land on the eval_runs row and the suite's
 * cached pass_rate / delta / last_ran_at fields.
 *
 * Real model calls happen when EVAL_ANTHROPIC_KEY / EVAL_OPENAI_KEY are
 * configured (see eval-llm.ts). Without them, the worker falls back to
 * a deterministic mock provider — same plumbing, no API spend, useful
 * for the demo and CI.
 */

import postgres, { type Sql } from "postgres";
import { createHash, randomUUID } from "node:crypto";
import { callModel, providerStatus } from "./eval-llm";

const POLL_INTERVAL_MS = 10_000;
const CLAIM_BATCH = 5;

type QueuedRun = { id: string; suite_id: string };

type SuiteSnapshot = {
  model: string;
  baseline_pass_rate: number;
};

type CaseRow = {
  id: string;
  name: string;
  prompt: string;
  expected_pattern: string;
};

export async function startEvalTick(): Promise<() => Promise<void>> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[realtime] DATABASE_URL not set — eval tick disabled");
    return async () => undefined;
  }

  const sql = postgres(url, { max: 2, idle_timeout: 0, prepare: false });

  let running = true;
  let inFlight = false;

  async function runTick() {
    if (!running || inFlight) return;
    inFlight = true;
    try {
      await processBatch(sql);
    } catch (err) {
      console.error("[realtime] eval tick failed", err);
    } finally {
      inFlight = false;
    }
  }

  await sql.listen("eval_run_pending", () => {
    void runTick();
  });

  const interval = setInterval(() => void runTick(), POLL_INTERVAL_MS);
  void runTick();

  const provs = providerStatus();
  console.log(
    `[realtime] eval run tick · poll ${POLL_INTERVAL_MS / 1000}s · batch ${CLAIM_BATCH} · anthropic=${provs.anthropic ? "on" : "off"} openai=${provs.openai ? "on" : "off"}`,
  );

  return async () => {
    running = false;
    clearInterval(interval);
    await sql.end();
  };
}

async function processBatch(sql: Sql): Promise<void> {
  const queued = await sql<QueuedRun[]>`
    SELECT id, suite_id
    FROM eval_runs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT ${CLAIM_BATCH}
  `;
  if (queued.length === 0) return;

  for (const row of queued) {
    void runOne(sql, row).catch((err: unknown) => {
      console.error("[realtime] eval run crashed", row.id, err);
    });
  }
}

async function runOne(sql: Sql, row: QueuedRun): Promise<void> {
  // Claim — flip to running. If another worker beat us to it, exit.
  const claimed = await sql<{ id: string }[]>`
    UPDATE eval_runs
    SET status = 'running', started_at = now()
    WHERE id = ${row.id} AND status = 'queued'
    RETURNING id
  `;
  if (claimed.length === 0) return;

  const [suite] = await sql<SuiteSnapshot[]>`
    SELECT model, baseline_pass_rate FROM eval_suites WHERE id = ${row.suite_id}
  `;
  if (!suite) {
    await sql`
      UPDATE eval_runs
      SET status = 'error', finished_at = now(), error = 'suite not found'
      WHERE id = ${row.id}
    `;
    return;
  }

  const cases = await sql<CaseRow[]>`
    SELECT id, name, prompt, expected_pattern
    FROM eval_cases
    WHERE suite_id = ${row.suite_id} AND enabled = true
    ORDER BY id
  `;

  if (cases.length === 0) {
    await sql`
      UPDATE eval_runs
      SET status = 'error',
          finished_at = now(),
          error = 'no enabled cases for suite'
      WHERE id = ${row.id}
    `;
    return;
  }

  let passed = 0;
  let totalCostUsd = 0;
  for (const c of cases) {
    const call = await callModel({ model: suite.model, prompt: c.prompt });
    const ok = call.error ? false : matchesExpected(call.text, c.expected_pattern);
    if (ok) passed += 1;
    totalCostUsd += call.cost_usd;

    await sql`
      INSERT INTO eval_case_results
        (id, run_id, case_id, passed, output, latency_ms, cost_usd, error)
      VALUES
        (${`ecr_${randomUUID().replace(/-/g, "").slice(0, 16)}`},
         ${row.id},
         ${c.id},
         ${ok},
         ${truncate(call.text, 1024)},
         ${call.latency_ms},
         ${call.cost_usd},
         ${call.error ?? null})
    `;
  }

  const pass_rate = Number((passed / cases.length).toFixed(4));
  const finalStatus = pass_rate >= suite.baseline_pass_rate - 0.05 ? "passed" : "failed";

  await sql`
    UPDATE eval_runs
    SET status = ${finalStatus},
        finished_at = now(),
        pass_rate = ${pass_rate},
        cases_run = ${cases.length}
    WHERE id = ${row.id}
  `;

  const delta = pass_rate - suite.baseline_pass_rate;
  const suiteStatus =
    delta < -0.05 ? "bad" : delta < -0.02 ? "warn" : "ok";

  await sql`
    UPDATE eval_suites
    SET pass_rate = ${pass_rate},
        delta = ${delta},
        last_ran_at = now(),
        status = ${suiteStatus}
    WHERE id = ${row.suite_id}
  `;

  // totalCostUsd is computed but not stored at the run level today — it'd
  // need a column. Useful for the future budget tie-in.
  void totalCostUsd;
}

function matchesExpected(text: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, "i").test(text);
  } catch {
    // Bad pattern in the seed → treat as failure rather than error so the
    // suite still completes. The case-result row's `output` shows what we
    // got and the operator can fix the pattern.
    return false;
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

/** Cheap deterministic hash export — useful if a callsite ever wants to
 *  derive a stable seed without re-implementing it. Currently unused at
 *  the module level; kept since other ticks have analogous helpers. */
export function deterministicHash(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 16);
}
