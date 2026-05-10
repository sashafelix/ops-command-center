import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";

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
});
