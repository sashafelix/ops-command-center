import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

export const statusPageRouter = router({
  /** mode='public' filters to publicly-visible signals + incidents only. */
  overview: protectedProcedure
    .input(z.object({ mode: z.enum(["internal", "public"]).default("internal") }).optional())
    .query(async ({ input }) => {
      const mode = input?.mode ?? "internal";
      const [meta, signals, incidents] = await Promise.all([
        db.select().from(schema.status_page_meta).where(eq(schema.status_page_meta.id, "default")),
        db.select().from(schema.status_signals),
        db.select().from(schema.status_incidents).orderBy(desc(schema.status_incidents.started_at)),
      ]);

      const publicSignals = signals
        .filter((s) => s.is_public)
        .map((s) => ({
          id: s.id,
          name: s.name,
          state: s.state,
          uptime: s.uptime ?? "—",
          last_incident: s.last_incident ?? "—",
          uptime90: s.uptime90,
        }));
      const privateSignals = signals
        .filter((s) => !s.is_public)
        .map((s) => ({
          id: s.id,
          name: s.name,
          state: s.state,
          note: s.note ?? "",
        }));

      const allIncidents = incidents.map((i) => ({
        id: i.id,
        title: i.title,
        state: i.state,
        started_at: i.started_at,
        updates: i.updates,
        public: i.is_public,
      }));

      const m = meta[0];
      return {
        url: m?.url ?? "",
        published: m?.published ?? false,
        publicSignals,
        privateSignals: mode === "public" ? [] : privateSignals,
        incidents: mode === "public" ? allIncidents.filter((i) => i.public) : allIncidents,
      };
    }),

  /** Flip the published flag on the public status page. Admin, re-auth, audit. */
  setPublished: adminProcedure
    .input(z.object({ published: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      await db
        .insert(schema.status_page_meta)
        .values({ id: "default", url: "", published: input.published })
        .onConflictDoUpdate({
          target: schema.status_page_meta.id,
          set: { published: input.published },
        });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: input.published ? "status-page.publish" : "status-page.unpublish",
        target: "status-page/default",
      });
      return { published: input.published };
    }),

  /** Move an incident through its state machine. Admin, re-auth, audit. */
  setIncidentState: adminProcedure
    .input(
      z.object({
        id: z.string().min(1).max(120),
        state: z.enum(["investigating", "monitoring", "resolved"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const updated = await db
        .update(schema.status_incidents)
        .set({ state: input.state })
        .where(eq(schema.status_incidents.id, input.id))
        .returning({ id: schema.status_incidents.id });
      if (updated.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: `incident.${input.state}`,
        target: `status-incident/${input.id}`,
      });
      return { id: input.id, state: input.state };
    }),
});
