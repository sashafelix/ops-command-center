import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

export const reportsRouter = router({
  overview: protectedProcedure.query(async () => {
    const [scheduled, ad_hoc, bundles] = await Promise.all([
      db.select().from(schema.scheduled_reports).orderBy(schema.scheduled_reports.id),
      db
        .select()
        .from(schema.ad_hoc_reports)
        .orderBy(desc(schema.ad_hoc_reports.generated_at)),
      db.select().from(schema.compliance_bundles),
    ]);

    const [{ delivered_30d = 0 } = { delivered_30d: 0 }] = await db
      .select({ delivered_30d: sql<number>`count(*)::int` })
      .from(schema.audit_events)
      .where(sql`${schema.audit_events.action} LIKE 'report.%'`);

    return {
      kpi: {
        scheduled: scheduled.length,
        delivered_30d,
        ad_hoc: ad_hoc.length,
        bundles: bundles.length,
      },
      scheduled: scheduled.map((r) => ({
        id: r.id,
        name: r.name,
        cadence: r.cadence,
        next_run: r.next_run,
        recipients: r.recipients,
        format: r.format,
        last_run: r.last_run ?? "—",
      })),
      ad_hoc: ad_hoc.map((r) => ({
        id: r.id,
        name: r.name,
        by: r.by,
        when: r.generated_at.toLocaleDateString(),
        size: r.size,
      })),
      bundles: bundles.map((b) => ({
        id: b.id as "soc2" | "iso27001" | "eu-ai-act",
        name: b.name,
        framework: b.framework,
        status: b.status,
        last_built: b.last_built,
        range: b.range,
        content_hash: b.content_hash,
      })),
    };
  }),

  /**
   * Fire a scheduled report on-demand. Records an ad_hoc_reports row using
   * the scheduled template's name + format and bumps last_run to "just
   * now". Audit action `report.runScheduled` so the reports KPI
   * `delivered_30d` count is real (it filters on action LIKE 'report.%').
   */
  runScheduled: adminProcedure
    .input(z.object({ id: z.string().min(1).max(120) }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const [sched] = await db
        .select()
        .from(schema.scheduled_reports)
        .where(eq(schema.scheduled_reports.id, input.id));
      if (!sched) throw new TRPCError({ code: "NOT_FOUND" });

      const actor = ctx.session.user.email ?? "unknown";
      const adhocId = `rpt_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

      await db.insert(schema.ad_hoc_reports).values({
        id: adhocId,
        name: `${sched.name} (manual run)`,
        by: actor,
        size: "queued",
      });

      await db
        .update(schema.scheduled_reports)
        .set({ last_run: "just now" })
        .where(eq(schema.scheduled_reports.id, input.id));

      await appendAuditEvent({
        actor,
        role: "admin",
        action: "report.runScheduled",
        target: `report/${input.id}`,
      });

      return { ok: true as const, ad_hoc_id: adhocId };
    }),

  /**
   * One-off ad-hoc report. Records the row + audit event; actual content
   * generation lands later (along with a real download endpoint).
   */
  runAdHoc: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(160),
        format: z.enum(["PDF", "CSV", "JSONL"]).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const actor = ctx.session.user.email ?? "unknown";
      const id = `rpt_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
      await db.insert(schema.ad_hoc_reports).values({
        id,
        name: input.name,
        by: actor,
        size: "queued",
      });
      await appendAuditEvent({
        actor,
        role: "admin",
        action: "report.runAdHoc",
        target: `report/${id}`,
      });
      return { ok: true as const, id };
    }),

  /**
   * Rebuild a compliance bundle (SOC2 / ISO27001 / EU AI Act). Marks the
   * bundle as `ready` with `last_built` = now. Audit-logged; the audit
   * row drives the bundle's content_hash on a future PR.
   */
  buildBundle: adminProcedure
    .input(z.object({ id: z.string().min(1).max(120) }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const now = new Date().toLocaleDateString();
      const updated = await db
        .update(schema.compliance_bundles)
        .set({ status: "ready", last_built: now })
        .where(eq(schema.compliance_bundles.id, input.id))
        .returning({ id: schema.compliance_bundles.id });
      if (updated.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "report.buildBundle",
        target: `bundle/${input.id}`,
      });
      return { ok: true as const, id: input.id };
    }),
});
