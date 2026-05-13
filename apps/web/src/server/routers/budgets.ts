import { eq, desc, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

export const budgetsRouter = router({
  overview: protectedProcedure.query(async () => {
    const since30d = sql`now() - interval '30 days'`;
    const [meta, teams, breaches, topRows] = await Promise.all([
      db.select().from(schema.budget_meta).where(eq(schema.budget_meta.id, "default")),
      db.select().from(schema.budgets).orderBy(schema.budgets.id),
      db.select().from(schema.budget_breaches).orderBy(desc(schema.budget_breaches.when)),
      // Top-cost sessions in the last 30d. Limited to 8 for the panel.
      db
        .select()
        .from(schema.sessions)
        .where(gte(schema.sessions.started_at, since30d))
        .orderBy(desc(schema.sessions.cost_usd))
        .limit(8),
    ]);
    const m = meta[0];

    const top_runs = topRows.map((r) => ({
      id: r.id,
      goal: r.goal,
      agent: r.agent_version,
      cost_usd: r.cost_usd,
      duration: fmtDuration(r.runtime_s),
      when: relTime(r.started_at),
      status: r.outcome === "aborted" ? ("aborted" as const) : (r.status as "ok" | "warn" | "bad"),
    }));

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

  /**
   * Update a team's caps. Either or both fields can be set; omitting one
   * leaves it untouched. daily_cap = USD/day, cap_mtd = USD/month.
   * adminProcedure because cap edits are money decisions, not SRE moves.
   */
  setCap: adminProcedure
    .input(
      z.object({
        team_id: z.string().min(1).max(120),
        daily_cap: z.number().min(0).max(1_000_000).optional(),
        cap_mtd: z.number().min(0).max(50_000_000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const update: Record<string, number> = {};
      if (input.daily_cap !== undefined) update.daily_cap = input.daily_cap;
      if (input.cap_mtd !== undefined) update.cap_mtd = input.cap_mtd;
      if (Object.keys(update).length === 0) return { ok: true as const };
      const updated = await db
        .update(schema.budgets)
        .set(update)
        .where(eq(schema.budgets.team_id, input.team_id))
        .returning({ id: schema.budgets.id });
      if (updated.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "budget.setCap",
        target: `budget/${input.team_id}`,
      });
      return { ok: true as const };
    }),

  /** Workspace-level caps live on the singleton budget_meta row. Admin-only. */
  setWorkspaceCaps: adminProcedure
    .input(
      z.object({
        cap_day: z.number().min(0).max(10_000_000).optional(),
        cap_month: z.number().min(0).max(500_000_000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const update: Record<string, number> = {};
      if (input.cap_day !== undefined) update.cap_day = input.cap_day;
      if (input.cap_month !== undefined) update.cap_month = input.cap_month;
      if (Object.keys(update).length === 0) return { ok: true as const };
      await db
        .insert(schema.budget_meta)
        .values({ id: "default", ...update })
        .onConflictDoUpdate({ target: schema.budget_meta.id, set: update });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "budget.setWorkspaceCaps",
        target: "budget/workspace",
      });
      return { ok: true as const };
    }),

  /** Mark a breach as handled. Idempotent; audit-logged. */
  resolveBreach: adminProcedure
    .input(z.object({ id: z.string().min(1).max(120) }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const updated = await db
        .update(schema.budget_breaches)
        .set({ resolved: true })
        .where(eq(schema.budget_breaches.id, input.id))
        .returning({ id: schema.budget_breaches.id });
      if (updated.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "budget.resolveBreach",
        target: `breach/${input.id}`,
      });
      return { ok: true as const };
    }),
});

function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function relTime(then: Date): string {
  const ms = Date.now() - then.getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
