import { isNull, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { kvGet } from "@/db/kv";

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

export const liveRouter = router({
  /** Top-priority active session for the NOW PLAYING strip. */
  now: protectedProcedure.query(() =>
    kvGet<NowPlaying | null>("live.now_playing", null),
  ),

  /** KPI row on the LIVE board. */
  kpi: protectedProcedure.query(() =>
    kvGet<LiveKpi>("live.kpi", {
      spend24h: 0,
      spendPrev: 0,
      sessions24h: 0,
      toolCalls24h: 0,
      avgTrust: 1,
      p95LatencyS: 0,
    }),
  ),

  /**
   * Sidebar nav badges. Approvals is derived live from the row count of
   * undecided rows; everything else stays at zero until P7 wires real
   * triggers. Per HANDOFF acceptance, badges disappear at zero.
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
