import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";

export const auditLogRouter = router({
  /** KPIs for the header strip. */
  kpi: protectedProcedure.query(() => {
    const events = mockStore.auditEvents;
    const last24 = events.filter((e) => Date.now() - new Date(e.ts).getTime() < 24 * 60 * 60 * 1000);
    const actors = new Set(events.map((e) => e.actor));
    const anchored = events.filter((e) => e.anchored_at).length;
    return {
      events_24h: last24.length,
      unique_actors: actors.size,
      chain_integrity_pct: 100,
      retention: "7y",
      anchored,
      total: events.length,
    };
  }),

  /** Paginated, optionally filtered slice. Returns rows in chain order. */
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(2000).default(200),
          offset: z.number().int().nonnegative().default(0),
          actor: z.string().optional(),
          action: z.string().optional(),
          target: z.string().optional(),
        })
        .optional(),
    )
    .query(({ input }) => {
      const i = input ?? { limit: 200, offset: 0 };
      let rows = mockStore.auditEvents;
      if (i.actor) rows = rows.filter((r) => r.actor === i.actor);
      if (i.action) rows = rows.filter((r) => r.action === i.action);
      if (i.target) rows = rows.filter((r) => r.target.includes(i.target!));
      const total = rows.length;
      // Most-recent-first display, but we keep chain order under the hood
      // by returning a slice from the tail. The verifier walks chain order.
      const start = Math.max(0, total - (i.offset ?? 0) - (i.limit ?? 200));
      const end = total - (i.offset ?? 0);
      return { rows: rows.slice(start, end), total };
    }),

  /** Returns the entire chain (for the client-side verifier). Heavy by design. */
  chain: protectedProcedure.query(() => mockStore.auditEvents),

  /** Distinct values for the filter chips. */
  facets: protectedProcedure.query(() => {
    const actors = Array.from(new Set(mockStore.auditEvents.map((e) => e.actor))).sort();
    const actions = Array.from(new Set(mockStore.auditEvents.map((e) => e.action))).sort();
    return { actors, actions };
  }),
});
