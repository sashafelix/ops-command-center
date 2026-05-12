import { desc, eq, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, analystProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { kvGet } from "@/db/kv";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

type EvalsKpi = {
  suites: number;
  total_cases: number;
  passing: string;
  regressions: number;
  drift: string;
};

type EvalABBlob = {
  name: string;
  a: { label: string; wins: number; score: number };
  b: { label: string; wins: number; score: number };
  trials: string;
  significance: string;
};

export const evalsRouter = router({
  overview: protectedProcedure.query(async () => {
    const [suites, regressions, ab, kpiOverride] = await Promise.all([
      db.select().from(schema.eval_suites).orderBy(schema.eval_suites.id),
      db
        .select()
        .from(schema.eval_regressions)
        .orderBy(desc(schema.eval_regressions.first_fail)),
      db.select().from(schema.eval_ab).where(eq(schema.eval_ab.id, "default")),
      kvGet<Partial<EvalsKpi>>("evals.kpi", {}),
    ]);

    // Per-suite live state: is there an in-flight run right now?
    const inflight = await db
      .select({
        suite_id: schema.eval_runs.suite_id,
        c: sql<number>`count(*)::int`,
      })
      .from(schema.eval_runs)
      .where(inArray(schema.eval_runs.status, ["queued", "running"]))
      .groupBy(schema.eval_runs.suite_id);
    const inflightBySuite = new Map(inflight.map((r) => [r.suite_id, r.c]));

    const totalCases = suites.reduce((s, x) => s + x.cases, 0);
    const avgPass =
      suites.length === 0
        ? 0
        : suites.reduce((s, x) => s + x.pass_rate, 0) / suites.length;

    const [{ c: regCount } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.eval_regressions);

    const kpi: EvalsKpi = {
      suites: suites.length,
      total_cases: totalCases,
      passing: kpiOverride.passing ?? `${(avgPass * 100).toFixed(1)}%`,
      regressions: regCount,
      drift: kpiOverride.drift ?? "0.0%",
    };

    const abRow = ab[0];
    const abShape: EvalABBlob = abRow
      ? {
          name: abRow.name,
          a: { label: abRow.a_label, wins: abRow.a_wins, score: abRow.a_score },
          b: { label: abRow.b_label, wins: abRow.b_wins, score: abRow.b_score },
          trials: abRow.trials,
          significance: abRow.significance,
        }
      : {
          name: "—",
          a: { label: "—", wins: 0, score: 0 },
          b: { label: "—", wins: 0, score: 0 },
          trials: "—",
          significance: "—",
        };

    return {
      kpi,
      suites: suites.map((s) => ({
        id: s.id,
        cases: s.cases,
        pass_rate: s.pass_rate,
        delta: s.delta,
        last: s.last_ran_at ? ageString(s.last_ran_at) : "—",
        baseline: s.baseline_pass_rate,
        model: s.model,
        flake_rate: s.flake_rate,
        status: s.status,
        trend: s.trend,
        running: (inflightBySuite.get(s.id) ?? 0) > 0,
      })),
      regressions: regressions.map((r) => ({
        id: r.id,
        suite: r.suite_id,
        case: r.case,
        model: r.model,
        first_fail: ageString(r.first_fail),
        occurrences: r.occurrences,
        owner: r.owner,
        commit: r.commit,
      })),
      ab: abShape,
    };
  }),

  /**
   * Recent runs — optional suite filter, newest first.
   */
  recentRuns: protectedProcedure
    .input(
      z
        .object({
          suite_id: z.string().min(1).max(120).optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const i = input ?? { limit: 50 };
      const baseQ = db
        .select({
          id: schema.eval_runs.id,
          suite_id: schema.eval_runs.suite_id,
          status: schema.eval_runs.status,
          started_by: schema.eval_runs.started_by,
          created_at: schema.eval_runs.created_at,
          started_at: schema.eval_runs.started_at,
          finished_at: schema.eval_runs.finished_at,
          pass_rate: schema.eval_runs.pass_rate,
          cases_run: schema.eval_runs.cases_run,
          error: schema.eval_runs.error,
        })
        .from(schema.eval_runs)
        .orderBy(desc(schema.eval_runs.created_at));
      const rows = i.suite_id
        ? await baseQ.where(eq(schema.eval_runs.suite_id, i.suite_id)).limit(i.limit ?? 50)
        : await baseQ.limit(i.limit ?? 50);
      return rows.map((r) => ({
        id: r.id,
        suite_id: r.suite_id,
        status: r.status as "queued" | "running" | "passed" | "failed" | "error",
        started_by: r.started_by,
        created_at: r.created_at.toISOString(),
        started_at: r.started_at?.toISOString() ?? null,
        finished_at: r.finished_at?.toISOString() ?? null,
        pass_rate: r.pass_rate,
        cases_run: r.cases_run,
        error: r.error,
      }));
    }),

  /**
   * Queue a real eval run. The realtime worker (apps/realtime/eval-tick.ts)
   * picks the row up, simulates execution, and updates the suite's cached
   * pass_rate / last_ran_at when done.
   */
  runSuite: analystProcedure
    .input(z.object({ suite_id: z.string().min(1).max(120) }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const [suite] = await db
        .select({ id: schema.eval_suites.id })
        .from(schema.eval_suites)
        .where(eq(schema.eval_suites.id, input.suite_id));
      if (!suite) throw new TRPCError({ code: "NOT_FOUND" });

      const actor = ctx.session.user.email ?? "unknown";
      const run_id = `run_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
      await db.insert(schema.eval_runs).values({
        id: run_id,
        suite_id: input.suite_id,
        status: "queued",
        started_by: actor,
      });

      // Wake the worker so it doesn't have to wait for the next poll.
      await db.execute(sql`SELECT pg_notify('eval_run_pending', '')`);

      await appendAuditEvent({
        actor,
        role: "admin",
        action: "evals.run",
        target: `suite/${input.suite_id}`,
      });
      return { run_id, suite_id: input.suite_id, status: "queued" as const };
    }),
});

function ageString(then: Date): string {
  const ms = Date.now() - then.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
