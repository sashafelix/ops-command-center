import { z } from "zod";
import { desc, eq, gte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { appendAuditEvent } from "../audit-append";
import { requireFreshAuth } from "../reauth";
import { mintApiToken, VALID_SCOPES, type Scope } from "../api-tokens";
import { connectorFor, CONNECTORS } from "../connectors/registry";
import { deriveStatus } from "../connectors/derive-status";
import type { Connection } from "@/server/mock/seed";

export const settingsRouter = router({
  overview: protectedProcedure.query(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [workspace, connections, members, tokens, webhooks, prefs, deliveryStats] =
      await Promise.all([
        db.select().from(schema.workspace).where(eq(schema.workspace.id, "default")),
        db.select().from(schema.connections).orderBy(schema.connections.category, schema.connections.name),
        db.select().from(schema.members).orderBy(schema.members.role, schema.members.name),
        db.select().from(schema.tokens).orderBy(schema.tokens.created_at),
        db.select().from(schema.webhooks),
        db.select().from(schema.prefs).where(eq(schema.prefs.id, "default")),
        // Group webhook_deliveries by webhook + status for the last 24h so we
        // can render real "delivered/total" stats instead of the seed string.
        db
          .select({
            webhook_id: schema.webhook_deliveries.webhook_id,
            status: schema.webhook_deliveries.status,
            count: sql<number>`count(*)::int`,
            most_recent: sql<Date | null>`max(${schema.webhook_deliveries.created_at})`,
          })
          .from(schema.webhook_deliveries)
          .where(gte(schema.webhook_deliveries.created_at, since24h))
          .groupBy(schema.webhook_deliveries.webhook_id, schema.webhook_deliveries.status),
      ]);

    const w = workspace[0];
    const p = prefs[0];

    return {
      general: {
        workspace_name: w?.workspace_name ?? "—",
        org_id: w?.org_id ?? "—",
        created_at: w?.created_at ?? "—",
        tier: w?.tier ?? "—",
      },
      connections: connections.map((c) => {
        // Derived status — single source of truth. The DB status/health are
        // cached values updated by mutations; this re-derives on every read
        // so the UI never lies about state.
        const derived = deriveStatus({
          id: c.id,
          fields: c.fields,
          last_test_at: c.last_test_at,
          last_test_ok: c.last_test_ok,
        });
        return {
          id: c.id,
          name: c.name,
          category: c.category,
          status: derived.status,
          detail: c.detail,
          fields: c.fields,
          last_sync: c.last_sync,
          health: derived.health,
          last_test_at: c.last_test_at?.toISOString() ?? null,
          last_test_detail: c.last_test_detail ?? null,
          last_test_ok: c.last_test_ok ?? null,
          /** Whether a connector implementation exists (Test button enabled). */
          has_connector: connectorFor(c.id) !== undefined,
        };
      }),
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        mfa: m.mfa,
        last_seen: m.last_seen ? ageString(m.last_seen) : "—",
      })),
      tokens: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        scope: t.scope,
        created_at: t.created_at.toLocaleDateString(),
        last_used: t.last_used ? ageString(t.last_used) : "—",
        expires_at: t.expires_at?.toLocaleDateString() ?? "—",
      })),
      webhooks: webhooks.map((w) => {
        const rows = deliveryStats.filter((r) => r.webhook_id === w.id);
        const counts = {
          pending: 0,
          delivered: 0,
          dead: 0,
        };
        let mostRecent: Date | null = null;
        for (const r of rows) {
          if (r.status === "pending") counts.pending = r.count;
          else if (r.status === "delivered") counts.delivered = r.count;
          else if (r.status === "dead") counts.dead = r.count;
          if (r.most_recent && (!mostRecent || r.most_recent > mostRecent)) {
            mostRecent = r.most_recent;
          }
        }
        const total = counts.pending + counts.delivered + counts.dead;
        const pct = total === 0 ? null : (counts.delivered / total) * 100;
        return {
          id: w.id,
          url: w.url,
          events: w.events,
          status: w.status,
          delivery_stats:
            total === 0
              ? "no deliveries in 24h"
              : `${counts.delivered}/${total} · ${pct!.toFixed(1)}%`,
          delivered_24h: counts.delivered,
          pending_24h: counts.pending,
          dead_24h: counts.dead,
          last_delivery_at: mostRecent?.toISOString() ?? null,
        };
      }),
      prefs: {
        retention: p?.retention ?? "90 days",
        timezone: p?.timezone ?? "UTC",
        density: (p?.density ?? "compact") as "compact" | "comfortable",
        auto_refresh: p?.auto_refresh ?? true,
        ambient_audio: p?.ambient_audio ?? false,
        theme: (p?.theme ?? "system") as "system" | "dark" | "light",
        language: p?.language ?? "en-US",
        experimental: p?.experimental ?? false,
      },
      about: {
        version: w?.version ?? "0.0.0",
        build_id: w?.build_id ?? "dev",
        commit: w?.commit ?? "HEAD",
        built_at: w?.built_at?.toISOString() ?? new Date().toISOString(),
      },
    };
  }),

  // ===========================================================================
  // General + Preferences
  // ===========================================================================

  saveGeneral: adminProcedure
    .input(
      z.object({
        workspace_name: z.string().min(1).max(120).optional(),
        tier: z.string().min(1).max(60).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const set: Record<string, unknown> = {};
      if (input.workspace_name !== undefined) set.workspace_name = input.workspace_name;
      if (input.tier !== undefined) set.tier = input.tier;
      if (Object.keys(set).length === 0) return { ok: true };
      await db.update(schema.workspace).set(set).where(eq(schema.workspace.id, "default"));
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "workspace.update",
        target: "workspace/default",
      });
      return { ok: true };
    }),

  savePrefs: adminProcedure
    .input(
      z.object({
        retention: z.string().optional(),
        timezone: z.string().optional(),
        density: z.enum(["compact", "comfortable"]).optional(),
        auto_refresh: z.boolean().optional(),
        ambient_audio: z.boolean().optional(),
        theme: z.enum(["system", "dark", "light"]).optional(),
        language: z.string().optional(),
        experimental: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const set: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) if (v !== undefined) set[k] = v;
      if (Object.keys(set).length === 0) return { ok: true };
      await db
        .insert(schema.prefs)
        .values({ id: "default", ...set } as typeof schema.prefs.$inferInsert)
        .onConflictDoUpdate({ target: schema.prefs.id, set });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "prefs.update",
        target: "prefs/default",
      });
      return { ok: true };
    }),

  // ===========================================================================
  // Members
  // ===========================================================================

  inviteMember: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        email: z.string().email(),
        role: z.enum(["Owner", "Admin", "SRE", "Analyst", "Viewer"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const id = `u_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
      try {
        await db.insert(schema.members).values({
          id,
          name: input.name,
          email: input.email,
          role: input.role,
          mfa: false,
        });
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "email already exists" });
      }
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "member.invite",
        target: `member/${id}`,
      });
      return { id };
    }),

  setMemberRole: adminProcedure
    .input(
      z.object({
        id: z.string(),
        role: z.enum(["Owner", "Admin", "SRE", "Analyst", "Viewer"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const updated = await db
        .update(schema.members)
        .set({ role: input.role })
        .where(eq(schema.members.id, input.id))
        .returning({ id: schema.members.id });
      if (updated.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "member.role.update",
        target: `member/${input.id}`,
      });
      return { ok: true };
    }),

  removeMember: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const removed = await db
        .delete(schema.members)
        .where(eq(schema.members.id, input.id))
        .returning({ id: schema.members.id });
      if (removed.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "member.remove",
        target: `member/${input.id}`,
      });
      return { ok: true };
    }),

  // ===========================================================================
  // Tokens — create (from P7) + revoke
  // ===========================================================================

  /**
   * Admin-only: mint a new API token. Returns the raw secret exactly once;
   * the DB stores only the SHA-256. Caller must show it to the operator with
   * "copy this now, you won't see it again" copy.
   */
  createToken: adminProcedure
    .input(
      z.object({
        name: z.string().min(2).max(60),
        scopes: z.array(z.enum(VALID_SCOPES)).min(1),
        expires_in_days: z.number().int().min(1).max(365 * 5).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const id = `tok_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const expires_at = input.expires_in_days
        ? new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000)
        : undefined;
      const { secret, row } = await mintApiToken({
        id,
        name: input.name,
        scopes: input.scopes as Scope[],
        expires_at,
      });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "token.create",
        target: `token/${id}`,
      });
      return {
        secret,
        token: { id: row.id, name: row.name, scopes: row.scopes, fingerprint: row.fingerprint },
      };
    }),

  revokeToken: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const removed = await db
        .delete(schema.tokens)
        .where(eq(schema.tokens.id, input.id))
        .returning({ id: schema.tokens.id });
      if (removed.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "token.revoke",
        target: `token/${input.id}`,
      });
      return { ok: true };
    }),

  // ===========================================================================
  // Webhooks — create + edit + delete + toggle
  // ===========================================================================

  saveWebhook: adminProcedure
    .input(
      z.object({
        id: z.string(),
        url: z.string().url().optional(),
        events: z.array(z.string()).min(0).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const set: Record<string, unknown> = {};
      if (input.url !== undefined) set.url = input.url;
      if (input.events !== undefined) set.events = input.events;
      if (Object.keys(set).length === 0) return { ok: true };
      const updated = await db
        .update(schema.webhooks)
        .set(set)
        .where(eq(schema.webhooks.id, input.id))
        .returning({ id: schema.webhooks.id });
      if (updated.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "webhook.update",
        target: `webhook/${input.id}`,
      });
      return { ok: true };
    }),

  createWebhook: adminProcedure
    .input(
      z.object({
        url: z.string().url(),
        events: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const id = `wh_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
      await db.insert(schema.webhooks).values({
        id,
        url: input.url,
        events: input.events,
        status: "ok",
        delivery_stats: "—",
      });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "webhook.create",
        target: `webhook/${id}`,
      });
      return { id };
    }),

  deleteWebhook: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const removed = await db
        .delete(schema.webhooks)
        .where(eq(schema.webhooks.id, input.id))
        .returning({ id: schema.webhooks.id });
      if (removed.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "webhook.delete",
        target: `webhook/${input.id}`,
      });
      return { ok: true };
    }),

  /**
   * Recent delivery attempts for one webhook. Powers the per-webhook detail
   * panel; ordered newest first.
   */
  webhookDeliveries: protectedProcedure
    .input(
      z.object({
        webhook_id: z.string().min(1).max(60),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: schema.webhook_deliveries.id,
          event_id: schema.webhook_deliveries.event_id,
          event_action: schema.webhook_deliveries.event_action,
          status: schema.webhook_deliveries.status,
          http_status: schema.webhook_deliveries.http_status,
          error: schema.webhook_deliveries.error,
          attempts: schema.webhook_deliveries.attempts,
          created_at: schema.webhook_deliveries.created_at,
          delivered_at: schema.webhook_deliveries.delivered_at,
          next_retry_at: schema.webhook_deliveries.next_retry_at,
        })
        .from(schema.webhook_deliveries)
        .where(eq(schema.webhook_deliveries.webhook_id, input.webhook_id))
        .orderBy(desc(schema.webhook_deliveries.created_at))
        .limit(input.limit);
      return rows.map((r) => ({
        id: r.id,
        event_id: r.event_id,
        event_action: r.event_action,
        status: r.status as "pending" | "delivered" | "dead",
        http_status: r.http_status,
        error: r.error,
        attempts: r.attempts,
        created_at: r.created_at.toISOString(),
        delivered_at: r.delivered_at?.toISOString() ?? null,
        next_retry_at: r.next_retry_at?.toISOString() ?? null,
      }));
    }),

  /**
   * Re-queue a delivery for another attempt. Resets attempts to 0 and clears
   * next_retry_at so the worker picks it up on its next tick. Useful for
   * "the receiver was down, I fixed it, redeliver." Admin-only, audit-logged.
   */
  redeliverWebhook: adminProcedure
    .input(z.object({ delivery_id: z.string().min(1).max(60) }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const updated = await db
        .update(schema.webhook_deliveries)
        .set({
          status: "pending",
          attempts: 0,
          error: null,
          http_status: null,
          next_retry_at: null,
          delivered_at: null,
        })
        .where(eq(schema.webhook_deliveries.id, input.delivery_id))
        .returning({ id: schema.webhook_deliveries.id, webhook_id: schema.webhook_deliveries.webhook_id });
      if (updated.length === 0) throw new TRPCError({ code: "NOT_FOUND" });

      // Wake the worker so it doesn't have to wait for the next poll.
      await db.execute(sql`SELECT pg_notify('webhook_delivery_pending', '')`);

      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "webhook.redeliver",
        target: `webhook_delivery/${input.delivery_id}`,
      });
      return { ok: true };
    }),

  // ===========================================================================
  // Connections — edit field values + test reachability
  // ===========================================================================

  /**
   * Update the editable values on a connection (host, token, env: refs, …).
   * Preserves the field shape (label, type) from the existing row so the
   * connector spec stays authoritative. If any field value actually changes,
   * clears the prior test result — last test was against different inputs,
   * so it no longer means anything.
   *
   * Audit row carries the connection id but never field values. Secrets and
   * env-var refs shouldn't end up in audit logs.
   */
  saveConnection: adminProcedure
    .input(
      z.object({
        id: z.string().min(1).max(60),
        values: z
          .array(
            z.object({
              k: z.string().min(1).max(60),
              value: z.string().max(8192),
            }),
          )
          .min(0)
          .max(40),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const [row] = await db
        .select()
        .from(schema.connections)
        .where(eq(schema.connections.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const byK = new Map(input.values.map((v) => [v.k, v.value]));
      const fields = row.fields.map((f) => ({
        ...f,
        value: byK.has(f.k) ? byK.get(f.k)! : f.value,
      }));

      const changed = fields.some((f, i) => f.value !== row.fields[i]?.value);

      // If values changed, the previous test result no longer applies.
      const update = {
        fields,
        ...(changed
          ? {
              last_test_at: null,
              last_test_detail: null,
              last_test_ok: null,
            }
          : {}),
      };

      const derived = deriveStatus({
        id: row.id,
        fields,
        last_test_at: changed ? null : row.last_test_at,
        last_test_ok: changed ? null : row.last_test_ok,
      });

      await db
        .update(schema.connections)
        .set({ ...update, status: derived.status, health: derived.health })
        .where(eq(schema.connections.id, input.id));

      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "connection.update",
        target: `connection/${input.id}`,
      });

      return { ok: true as const, changed };
    }),

  testConnection: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const [row] = await db
        .select()
        .from(schema.connections)
        .where(eq(schema.connections.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const connector = connectorFor(input.id);
      if (!connector) {
        return { ok: false, detail: "no connector implemented for this connection (stub-only)" } as const;
      }

      const conn: Connection = {
        id: row.id,
        name: row.name,
        category: row.category,
        status: row.status as Connection["status"],
        detail: row.detail,
        fields: row.fields,
        last_sync: row.last_sync,
        health: row.health,
      };

      const result = await connector.test(conn);
      const testedAt = new Date();
      const testDetail = result.ok ? result.detail : result.reason;

      const derived = deriveStatus({
        id: row.id,
        fields: row.fields,
        last_test_at: testedAt,
        last_test_ok: result.ok,
      });

      await db
        .update(schema.connections)
        .set({
          last_test_at: testedAt,
          last_test_detail: testDetail,
          last_test_ok: result.ok,
          status: derived.status,
          health: derived.health,
          detail: result.ok ? result.detail : `error · ${result.reason}`,
          last_sync: result.ok ? "just now" : row.last_sync,
        })
        .where(eq(schema.connections.id, input.id));

      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: result.ok ? "connection.test.ok" : "connection.test.fail",
        target: `connection/${input.id}`,
      });

      if (result.ok) return { ok: true as const, detail: result.detail };
      return { ok: false as const, detail: result.reason };
    }),

  /**
   * List the connector types operators can spin up new instances of. Drives
   * the "New connection" picker. Stub-only types aren't here — there's
   * nothing useful you can do with them yet.
   */
  listConnectorTypes: protectedProcedure.query(() => {
    return Object.values(CONNECTORS).map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
    }));
  }),

  /**
   * Create a fresh connection instance from a connector type. Pre-populates
   * fields from the connector's defaultFields(). Admin-only, fresh-auth.
   */
  createConnection: adminProcedure
    .input(
      z.object({
        type_id: z.string().min(1).max(60),
        instance_id: z
          .string()
          .regex(/^[a-z0-9_-]+$/, "lowercase letters, digits, _ and - only")
          .min(2)
          .max(60)
          .optional(),
        name: z.string().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const connector = CONNECTORS[input.type_id];
      if (!connector) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "unknown connector type" });
      }

      const id = input.instance_id ?? input.type_id;
      const existing = await db
        .select({ id: schema.connections.id })
        .from(schema.connections)
        .where(eq(schema.connections.id, id));
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `connection id "${id}" already exists — pass a different instance_id`,
        });
      }

      const fields = connector.defaultFields();
      const derived = deriveStatus({
        id,
        fields,
        last_test_at: null,
        last_test_ok: null,
      });

      await db.insert(schema.connections).values({
        id,
        name: input.name ?? connector.name,
        category: connector.category,
        status: derived.status,
        detail: "fill in fields and click Test to verify",
        fields,
        last_sync: "—",
        health: derived.health,
      });

      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "connection.create",
        target: `connection/${id}`,
      });

      return { ok: true as const, id };
    }),

  /** Permanently delete a connection. Admin-only, fresh-auth, audit-logged. */
  deleteConnection: adminProcedure
    .input(z.object({ id: z.string().min(1).max(60) }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const removed = await db
        .delete(schema.connections)
        .where(eq(schema.connections.id, input.id))
        .returning({ id: schema.connections.id });
      if (removed.length === 0) throw new TRPCError({ code: "NOT_FOUND" });

      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "connection.delete",
        target: `connection/${input.id}`,
      });

      return { ok: true as const };
    }),

  /** Admin-only — destructive workspace config touches secrets. */
  toggleWebhook: adminProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      await db
        .update(schema.webhooks)
        .set({ status: input.enabled ? "ok" : "warn" })
        .where(eq(schema.webhooks.id, input.id));
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "webhook.toggle",
        target: `webhook/${input.id}`,
      });
      return { id: input.id, enabled: input.enabled };
    }),
});

function ageString(then: Date): string {
  const ms = Date.now() - then.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
