import { eq, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { kvGet } from "@/db/kv";

type TopRun = {
  id: string;
  goal: string;
  agent: string;
  cost_usd: number;
  duration: string;
  when: string;
  status: "ok" | "warn" | "bad" | "aborted";
};

export const budgetsRouter = router({
  overview: protectedProcedure.query(async () => {
    const [meta, teams, breaches, top_runs] = await Promise.all([
      db.select().from(schema.budget_meta).where(eq(schema.budget_meta.id, "default")),
      db.select().from(schema.budgets).orderBy(schema.budgets.id),
      db.select().from(schema.budget_breaches).orderBy(desc(schema.budget_breaches.when)),
      kvGet<TopRun[]>("budgets.top_runs", []),
    ]);
    const m = meta[0];

    return {
      kpi: {
        spend_24h: m?.spend_24h ?? 0,
        cap_day: m?.cap_day ?? 0,
        spend_mtd: m?.spend_mtd ?? 0,
        cap_month: m?.cap_month ?? 0,
        forecast: m?.forecast ?? 0,
        breaches_30d: m?.breaches_30d ?? 0,
      },
      teams: teams.map((t) => ({
        id: t.id,
        label: t.label,
        spend_24h: t.spend_24h,
        cap: t.daily_cap,
        mtd: t.mtd_actual,
        cap_mtd: t.cap_mtd,
        agents: t.agents,
        runs: t.runs,
        trend: t.trend,
        spark: t.spark,
        status: t.status,
      })),
      breaches: breaches.map((b) => ({
        id: b.id,
        team: b.team,
        cap: b.cap,
        amount: b.amount,
        when: b.when.toLocaleDateString(),
        action: b.action,
        resolved: b.resolved,
      })),
      top_runs,
      mtd_daily: m?.mtd_daily ?? [],
      cap_line: m?.cap_line ?? 0,
    };
  }),
});
