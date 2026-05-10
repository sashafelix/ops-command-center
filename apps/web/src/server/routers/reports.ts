import { desc, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";

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
});
