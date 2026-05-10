import { z } from "zod";
import { sql, and, eq, like, isNotNull } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";

export const auditLogRouter = router({
  /** KPIs for the header strip. */
  kpi: protectedProcedure.query(async () => {
    const [{ total = 0 } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.audit_events);
    const [{ events_24h = 0 } = { events_24h: 0 }] = await db
      .select({ events_24h: sql<number>`count(*)::int` })
      .from(schema.audit_events)
      .where(sql`${schema.audit_events.ts} > now() - interval '24 hours'`);
    const [{ unique_actors = 0 } = { unique_actors: 0 }] = await db
      .select({ unique_actors: sql<number>`count(DISTINCT ${schema.audit_events.actor})::int` })
      .from(schema.audit_events);
    const [{ anchored = 0 } = { anchored: 0 }] = await db
      .select({ anchored: sql<number>`count(*)::int` })
      .from(schema.audit_events)
      .where(isNotNull(schema.audit_events.anchored_at));
    return {
      events_24h,
      unique_actors,
      chain_integrity_pct: 100,
      retention: "7y",
      anchored,
      total,
    };
  }),

  /** Paginated, optionally filtered slice. Returns rows in chain order (seq asc). */
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
    .query(async ({ input }) => {
      const i = input ?? { limit: 200, offset: 0 };
      const filters = [
        i.actor ? eq(schema.audit_events.actor, i.actor) : undefined,
        i.action ? eq(schema.audit_events.action, i.action) : undefined,
        i.target ? like(schema.audit_events.target, `%${i.target}%`) : undefined,
      ].filter((x): x is NonNullable<typeof x> => x !== undefined);
      const where = filters.length === 0 ? undefined : and(...filters);

      const totalQuery = db.select({ c: sql<number>`count(*)::int` }).from(schema.audit_events);
      const totalRows = where ? await totalQuery.where(where) : await totalQuery;
      const total = totalRows[0]?.c ?? 0;

      const rowsQuery = db.select().from(schema.audit_events).orderBy(schema.audit_events.seq);
      const rows = where
        ? await rowsQuery.where(where).limit(i.limit ?? 200).offset(i.offset ?? 0)
        : await rowsQuery.limit(i.limit ?? 200).offset(i.offset ?? 0);

      return {
        rows: rows.map((r) => ({
          id: r.id,
          ts: r.ts.toISOString(),
          actor: r.actor,
          role: r.role,
          action: r.action,
          target: r.target,
          ip: r.ip,
          ua: r.ua,
          hash: r.hash,
          prev_hash: r.prev_hash,
          ...(r.anchored_at ? { anchored_at: r.anchored_at.toISOString() } : {}),
        })),
        total,
      };
    }),

  /** Returns the entire chain (for the client-side verifier). Heavy by design. */
  chain: protectedProcedure.query(async () => {
    const rows = await db.select().from(schema.audit_events).orderBy(schema.audit_events.seq);
    return rows.map((r) => ({
      id: r.id,
      ts: r.ts.toISOString(),
      actor: r.actor,
      role: r.role,
      action: r.action,
      target: r.target,
      ip: r.ip,
      ua: r.ua,
      hash: r.hash,
      prev_hash: r.prev_hash,
      ...(r.anchored_at ? { anchored_at: r.anchored_at.toISOString() } : {}),
    }));
  }),

  /** Distinct values for the filter chips. */
  facets: protectedProcedure.query(async () => {
    const actorRows = await db
      .selectDistinct({ actor: schema.audit_events.actor })
      .from(schema.audit_events)
      .orderBy(schema.audit_events.actor);
    const actionRows = await db
      .selectDistinct({ action: schema.audit_events.action })
      .from(schema.audit_events)
      .orderBy(schema.audit_events.action);
    return {
      actors: actorRows.map((r) => r.actor),
      actions: actionRows.map((r) => r.action),
    };
  }),
});
