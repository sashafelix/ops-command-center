import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
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

let runCounter = 1000;

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

  /** Analyst+ — consumes budget. Re-auth + audit-event. */
  runSuite: analystProcedure
    .input(z.object({ suite_id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      runCounter += 1;
      const run_id = `run_${runCounter.toString(36)}`;
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
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
