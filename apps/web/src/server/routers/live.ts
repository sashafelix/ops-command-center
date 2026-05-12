import { and, eq, isNull, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";

type NowPlaying = {
  id: string;
  agent: string;
  model: string;
  repo: string;
  goal: string;
  runtime_s: number;
  cost_usd: number;
  tools: number;
  trust_score: number;
  current_step: string;
};

type LiveKpi = {
  spend24h: number;
  spendPrev: number;
  sessions24h: number;
  toolCalls24h: number;
  avgTrust: number;
  p95LatencyS: number;
};

const NAV_KEYS = [
  "live",
  "sessions",
  "approvals",
  "infra",
  "status-page",
  "agents",
  "evals",
  "budgets",
  "trust",
  "audit-log",
  "reports",
  "settings",
] as const;

const ZERO_KPI: LiveKpi = {
  spend24h: 0,
  spendPrev: 0,
  sessions24h: 0,
  toolCalls24h: 0,
  avgTrust: 1,
  p95LatencyS: 0,
};

export const liveRouter = router({
  /**
   * Top-priority active session for the NOW PLAYING strip.
   *
   * Priority order: pinned > hot > most recently started. Picks the single
   * row that scores best on those signals from sessions still
   * `outcome='in-progress'` in the `active` phase.
   */
  now: protectedProcedure.query(async (): Promise<NowPlaying | null> => {
    const [row] = await db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.outcome, "in-progress"),
          sql`(${schema.sessions.extra}->>'phase') = 'active'`,
        ),
      )
      .orderBy(
        sql`((${schema.sessions.extra}->>'pinned')::boolean) DESC NULLS LAST`,
        sql`((${schema.sessions.extra}->>'hot')::boolean) DESC NULLS LAST`,
        sql`${schema.sessions.started_at} DESC`,
      )
      .limit(1);
    if (!row) return null;
    const extra = (row.extra ?? {}) as { step?: string };
    return {
      id: row.id,
      agent: row.agent_version,
      model: row.model,
      repo: row.repo,
      goal: row.goal,
      runtime_s: row.runtime_s,
      cost_usd: row.cost_usd,
      tools: row.tool_calls,
      trust_score: row.trust_score,
      current_step: extra.step ?? "",
    };
  }),

  /**
   * KPI strip — real aggregates over the sessions + tool_calls tables.
   *   - spend24h / spendPrev: SUM(cost_usd) for the last 24h vs 24-48h ago
   *   - sessions24h:          COUNT(*) of sessions started in the last 24h
   *   - toolCalls24h:         COUNT(*) of tool_calls in the last 24h
   *   - avgTrust:             AVG(trust_score) over completed sessions in 24h
   *                           (falls back to all sessions if no completions)
   *   - p95LatencyS:          p95 of tool_calls.latency_ms in 24h, in seconds
   *
   * Returns {0, 0, 0, 0, 1, 0} on an empty DB so the UI renders zeros not
   * NaN.
   */
  kpi: protectedProcedure.query(async (): Promise<LiveKpi> => {
    type AggRow = {
      spend24h: number | null;
      spendPrev: number | null;
      sessions24h: number | null;
      avgTrustRecent: number | null;
      avgTrustAll: number | null;
    };
    type ToolAggRow = {
      tool_calls24h: number | null;
      p95_ms: number | null;
    };

    const [sessionAgg = null] = (await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN ${schema.sessions.started_at} >= now() - interval '24 hours'
                          THEN ${schema.sessions.cost_usd} END), 0)::float8 AS "spend24h",
        COALESCE(SUM(CASE WHEN ${schema.sessions.started_at} >= now() - interval '48 hours'
                          AND ${schema.sessions.started_at} <  now() - interval '24 hours'
                          THEN ${schema.sessions.cost_usd} END), 0)::float8 AS "spendPrev",
        COALESCE(SUM(CASE WHEN ${schema.sessions.started_at} >= now() - interval '24 hours'
                          THEN 1 ELSE 0 END), 0)::int AS "sessions24h",
        AVG(${schema.sessions.trust_score})
          FILTER (WHERE ${schema.sessions.outcome} <> 'in-progress'
                  AND ${schema.sessions.started_at} >= now() - interval '24 hours')
          ::float8 AS "avgTrustRecent",
        AVG(${schema.sessions.trust_score})::float8 AS "avgTrustAll"
      FROM ${schema.sessions}
    `)) as unknown as Array<AggRow | null>;

    const [toolAgg = null] = (await db.execute(sql`
      SELECT
        COALESCE(COUNT(*), 0)::int AS "tool_calls24h",
        COALESCE(
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${schema.tool_calls.latency_ms}),
          0
        )::float8 AS "p95_ms"
      FROM ${schema.tool_calls}
      JOIN ${schema.sessions} ON ${schema.sessions.id} = ${schema.tool_calls.session_id}
      WHERE ${schema.sessions.started_at} >= now() - interval '24 hours'
    `)) as unknown as Array<ToolAggRow | null>;

    if (!sessionAgg) return ZERO_KPI;

    const avgTrust =
      sessionAgg.avgTrustRecent ?? sessionAgg.avgTrustAll ?? ZERO_KPI.avgTrust;

    return {
      spend24h: round2(sessionAgg.spend24h ?? 0),
      spendPrev: round2(sessionAgg.spendPrev ?? 0),
      sessions24h: sessionAgg.sessions24h ?? 0,
      toolCalls24h: toolAgg?.tool_calls24h ?? 0,
      avgTrust: round2(avgTrust),
      p95LatencyS: round1((toolAgg?.p95_ms ?? 0) / 1000),
    };
  }),

  /**
   * Sidebar nav badges. Approvals is the only one with a real source today
   * (pending row count). The rest stay at 0 until their own surfaces grow
   * counters worth surfacing here.
   */
  navBadges: protectedProcedure.query(async () => {
    const [pending] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.approvals)
      .where(isNull(schema.approvals.decided_at));
    const out: Record<string, number> = {};
    for (const k of NAV_KEYS) out[k] = 0;
    out.approvals = pending?.c ?? 0;
    return out;
  }),
});

function round1(n: number): number {
  return Number(n.toFixed(1));
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}
