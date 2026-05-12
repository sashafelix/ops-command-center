import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, sreProcedure, adminProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

export const infraRouter = router({
  overview: protectedProcedure.query(async () => {
    const [regions, services, load, incidents, deploys, slos] = await Promise.all([
      db.select().from(schema.regions),
      db.select().from(schema.services).orderBy(schema.services.name),
      db.select().from(schema.service_load),
      db.select().from(schema.incidents).orderBy(desc(schema.incidents.started_at)),
      db
        .select()
        .from(schema.deploys)
        .where(eq(schema.deploys.target_kind, "service"))
        .orderBy(desc(schema.deploys.when)),
      db.select().from(schema.slos),
    ]);

    const byService = new Map<string, number[]>();
    for (const r of load) {
      let arr = byService.get(r.service_id);
      if (!arr) {
        arr = new Array<number>(60).fill(0);
        byService.set(r.service_id, arr);
      }
      if (r.minute >= 0 && r.minute < 60) arr[r.minute] = r.cpu_pct;
    }
    const loadShaped = Array.from(byService.entries()).map(([id, values]) => ({ id, values }));

    // KPI strip — computed from the same rows we just pulled. No KV.
    const openIncidents = incidents.filter((i) => i.status !== "resolved").length;
    const slosBreached = slos.filter((s) => s.state === "bad").length;
    // MTTR: average (resolved_at - started_at) over the last 30 days of
    // resolved incidents. "—" when there are none to average.
    const [{ mttr_s } = { mttr_s: null }] = await db.execute<{ mttr_s: number | null }>(sql`
      SELECT EXTRACT(EPOCH FROM AVG(${schema.incidents.resolved_at} - ${schema.incidents.started_at}))::float8 AS mttr_s
      FROM ${schema.incidents}
      WHERE ${schema.incidents.resolved_at} IS NOT NULL
        AND ${schema.incidents.started_at} > now() - interval '30 days'
    `);
    const mttr = mttr_s != null ? fmtDuration(Math.round(mttr_s)) : "—";
    // Uptime: fraction of (24h - sum-of-incident-durations) / 24h. Bounded
    // [0, 1]. Returns "—" if we have no incidents history to reason about.
    const [{ down_s } = { down_s: null }] = await db.execute<{ down_s: number | null }>(sql`
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (
        COALESCE(${schema.incidents.resolved_at}, now()) - ${schema.incidents.started_at}
      ))), 0)::float8 AS down_s
      FROM ${schema.incidents}
      WHERE ${schema.incidents.started_at} > now() - interval '24 hours'
    `);
    const downSeconds = Math.max(0, down_s ?? 0);
    const uptimeFrac = Math.max(0, Math.min(1, 1 - downSeconds / 86_400));
    const uptime = `${(uptimeFrac * 100).toFixed(3)}%`;

    return {
      kpi: { uptime, mttr, openIncidents, slosBreached },
      regions: regions.map((r) => ({
        id: r.id,
        name: r.name,
        status: narrowTone(r.status),
        nodes: r.nodes,
        az: r.az,
        cost_per_hour: r.cost_per_hour,
        traffic_pct: r.traffic_pct,
      })),
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        stack: s.stack,
        region: s.region,
        status: narrowTone(s.status),
        replicas: s.replicas,
        cpu_pct: s.cpu_pct,
        mem_pct: s.mem_pct,
        rps: s.rps,
        error_pct: s.error_pct,
        p95_ms: s.p95_ms,
        version: s.version,
        ...(s.reason ? { reason: s.reason } : {}),
      })),
      load: loadShaped,
      incidents: incidents.map((i) => ({
        id: i.id,
        severity: i.severity,
        title: i.title,
        service_id: i.service_id ?? "",
        age: ageString(i.started_at),
        assignee: i.assignee,
        status: i.status,
        ack_at: i.ack_at?.toISOString() ?? null,
        acked_by: i.acked_by ?? null,
        resolved_at: i.resolved_at?.toISOString() ?? null,
      })),
      deploys: deploys.map((d) => ({
        id: d.id,
        version: d.version,
        service: d.service_or_agent_id,
        who: d.who,
        when: ageString(d.when),
        status: deployTone(d.status),
        raw_status: d.status,
        rollback_candidate: d.rollback_candidate,
      })),
      slos: slos.map((s) => ({
        id: s.id,
        name: s.name,
        target: s.target,
        actual: s.actual,
        burn_rate: s.burn_rate,
        state: narrowTone(s.state),
      })),
    };
  }),

  /**
   * Acknowledge an incident. Records who + when, flips status to
   * "monitoring" so the surface shows it's being worked. Idempotent —
   * a second ack just refreshes the acked_by/ack_at fields.
   */
  ackIncident: sreProcedure
    .input(z.object({ id: z.string().min(1).max(120) }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const actor = ctx.session.user.email ?? "unknown";
      const updated = await db
        .update(schema.incidents)
        .set({
          ack_at: new Date(),
          acked_by: actor,
          status: "monitoring",
          assignee: actor,
        })
        .where(eq(schema.incidents.id, input.id))
        .returning({ id: schema.incidents.id });
      if (updated.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor,
        role: "admin",
        action: "incident.ack",
        target: `incident/${input.id}`,
      });
      return { id: input.id, ack_at: new Date().toISOString(), acked_by: actor };
    }),

  /** Mark an incident resolved. Records when. status flips to resolved. */
  resolveIncident: sreProcedure
    .input(z.object({ id: z.string().min(1).max(120) }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const updated = await db
        .update(schema.incidents)
        .set({
          resolved_at: new Date(),
          status: "resolved",
        })
        .where(eq(schema.incidents.id, input.id))
        .returning({ id: schema.incidents.id });
      if (updated.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "incident.resolve",
        target: `incident/${input.id}`,
      });
      return { id: input.id };
    }),

  /**
   * Roll back a service deploy. Refuses if the deploy isn't flagged as
   * rollback_candidate (operator misclicks shouldn't be able to roll back
   * anything they want — flag is set during deploy from upstream signals).
   * Refuses if already rolled back.
   */
  rollbackDeploy: sreProcedure
    .input(z.object({ deploy_id: z.string().min(1).max(120) }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const [dep] = await db
        .select()
        .from(schema.deploys)
        .where(
          and(
            eq(schema.deploys.id, input.deploy_id),
            eq(schema.deploys.target_kind, "service"),
          ),
        );
      if (!dep) throw new TRPCError({ code: "NOT_FOUND" });
      if (!dep.rollback_candidate) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "deploy is not flagged as a rollback candidate",
        });
      }
      if (dep.status === "rolled-back") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "deploy is already rolled back",
        });
      }
      await db
        .update(schema.deploys)
        .set({ status: "rolled-back" })
        .where(eq(schema.deploys.id, input.deploy_id));
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "deploy.rollback",
        target: `deploy/${dep.id}`,
      });
      return { id: dep.id, status: "rolled-back" as const };
    }),

  /**
   * Set a region's traffic_pct. 0 drains the region, 1 restores full.
   * Admin only — this is load-shifting on real infra, not an SRE-level
   * call.
   */
  setRegionTraffic: adminProcedure
    .input(
      z.object({
        id: z.string().min(1).max(120),
        traffic_pct: z.number().min(0).max(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const updated = await db
        .update(schema.regions)
        .set({ traffic_pct: input.traffic_pct })
        .where(eq(schema.regions.id, input.id))
        .returning({ id: schema.regions.id });
      if (updated.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: input.traffic_pct === 0 ? "region.drain" : "region.restore",
        target: `region/${input.id}`,
      });
      return { id: input.id, traffic_pct: input.traffic_pct };
    }),
});

/** services / regions / slos only ever surface ok | warn | bad in v1. */
function narrowTone(t: "ok" | "warn" | "bad" | "info" | "violet"): "ok" | "warn" | "bad" {
  if (t === "info" || t === "violet") return "ok";
  return t;
}

function ageString(then: Date): string {
  const ms = Date.now() - then.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

function deployTone(s: "rolled-out" | "rolling" | "rolled-back"): "ok" | "warn" | "bad" {
  if (s === "rolled-back") return "bad";
  if (s === "rolling") return "warn";
  return "ok";
}

function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const restMin = m % 60;
  if (h < 24) return restMin > 0 ? `${h}h ${restMin}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
