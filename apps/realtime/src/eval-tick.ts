/**
 * Eval run worker.
 *
 * apps/web's evals.runSuite mutation inserts an `eval_runs` row with
 * status='queued' and pg_notify's 'eval_run_pending'. This worker claims
 * those rows, marks them 'running', simulates the run, then writes the
 * outcome — also bumping eval_suites.pass_rate / delta / last_ran_at so
 * the dashboard reflects the latest result without a join on read.
 *
 * The simulation is deterministic given (suite_id, minute-bucket): a
 * pass_rate near the suite's baseline ±2%, 50–100% of cases run, and a
 * short delay so the running state is actually visible in the UI rather
 * than flashing past in <100ms.
 *
 * Real eval execution (calling the model, scoring, etc.) is a deep
 * rabbit hole — when it lands, only `simulateRun` changes.
 */

import postgres, { type Sql } from "postgres";
import { createHash } from "node:crypto";

const POLL_INTERVAL_MS = 10_000;
const CLAIM_BATCH = 5;

type QueuedRun = { id: string; suite_id: string };

type SuiteSnapshot = {
  baseline_pass_rate: number;
  cases: number;
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
  void runTick(); // catch up

  console.log(`[realtime] eval run tick · poll ${POLL_INTERVAL_MS / 1000}s · batch ${CLAIM_BATCH}`);

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
    SELECT baseline_pass_rate, cases FROM eval_suites WHERE id = ${row.suite_id}
  `;
  if (!suite) {
    await sql`
      UPDATE eval_runs
      SET status = 'error', finished_at = now(), error = 'suite not found'
      WHERE id = ${row.id}
    `;
    return;
  }

  const sim = simulateRun(row.suite_id, suite);
  // Visible "running" state — keep brief so the operator sees the spinner
  // but the demo doesn't drag.
  await delay(sim.durationMs);

  const finalStatus = sim.pass_rate >= suite.baseline_pass_rate - 0.05 ? "passed" : "failed";

  await sql`
    UPDATE eval_runs
    SET status = ${finalStatus},
        finished_at = now(),
        pass_rate = ${sim.pass_rate},
        cases_run = ${sim.cases_run}
    WHERE id = ${row.id}
  `;

  const delta = sim.pass_rate - suite.baseline_pass_rate;
  const suiteStatus =
    delta < -0.05 ? "bad" : delta < -0.02 ? "warn" : "ok";

  await sql`
    UPDATE eval_suites
    SET pass_rate = ${sim.pass_rate},
        delta = ${delta},
        last_ran_at = now(),
        status = ${suiteStatus}
    WHERE id = ${row.suite_id}
  `;
}

/**
 * Deterministic-ish simulator: same suite within the same wall-clock minute
 * produces the same result. Pass-rate clamped to baseline ± 2.5%, with a
 * small minute-bucket drift so re-running the same suite over time produces
 * a moving needle.
 */
function simulateRun(
  suite_id: string,
  suite: SuiteSnapshot,
): { pass_rate: number; cases_run: number; durationMs: number } {
  const minute = Math.floor(Date.now() / 60_000);
  const seedHex = createHash("sha256").update(`${suite_id}:${minute}`).digest("hex");
  // Take two bytes for a deterministic float in [0,1).
  const u1 = parseInt(seedHex.slice(0, 4), 16) / 0xffff;
  const u2 = parseInt(seedHex.slice(4, 8), 16) / 0xffff;

  // Pass-rate noise: ±2.5% around baseline
  const noise = (u1 - 0.5) * 0.05;
  const pass_rate = clamp01(suite.baseline_pass_rate + noise);

  // Run anywhere from 60% to 100% of declared cases
  const cases_run = Math.max(1, Math.round(suite.cases * (0.6 + u2 * 0.4)));

  // Simulated run duration: 2-6s so the running state is actually visible
  const durationMs = 2000 + Math.floor(u2 * 4000);

  return { pass_rate, cases_run, durationMs };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Number(n.toFixed(4));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
