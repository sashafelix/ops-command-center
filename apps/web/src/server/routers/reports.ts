import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";
import { generateReport, humanBytes, type ReportFormat, type ReportKind } from "../report-content";

const ReportKindEnum = z.enum(["audit-events", "sessions", "approvals"]);
const ReportFormatEnum = z.enum(["JSONL", "JSON", "CSV"]);

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
        kind: r.kind,
        format: r.format,
        has_content: r.content.length > 0,
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
   * Fire a scheduled report on-demand. Generates real content (last 7 days
   * of the scheduled report's kind, defaulting to audit-events if the
   * scheduled row didn't specify), records an ad_hoc_reports row, updates
   * last_run. Audit action `report.runScheduled` so the reports KPI
   * `delivered_30d` count is real.
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
      const format = (sched.format as ReportFormat) ?? "JSONL";
      // Scheduled rows don't carry a kind yet — default to audit-events,
      // which is the most useful general-purpose snapshot.
      const kind: ReportKind = "audit-events";
      const report = await generateReport(kind, format);

      await db.insert(schema.ad_hoc_reports).values({
        id: adhocId,
        name: `${sched.name} (manual run)`,
        by: actor,
        size: `${humanBytes(report.body.length)} · ${report.rowCount} rows`,
        kind,
        format,
        content: report.body,
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
   * One-off ad-hoc report. Generates real content immediately so the
   * download route can serve it without a worker round-trip. JSONL is the
   * default — line-delimited JSON is friendly to grep/jq/cut.
   */
  runAdHoc: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(160),
        kind: ReportKindEnum.default("audit-events"),
        format: ReportFormatEnum.default("JSONL"),
        since_days: z.number().int().min(1).max(365).default(7),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const actor = ctx.session.user.email ?? "unknown";
      const id = `rpt_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const report = await generateReport(input.kind, input.format, input.since_days);

      await db.insert(schema.ad_hoc_reports).values({
        id,
        name: input.name,
        by: actor,
        size: `${humanBytes(report.body.length)} · ${report.rowCount} rows`,
        kind: input.kind,
        format: input.format,
        content: report.body,
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
