import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { appendAuditEvent } from "../audit-append";
import { requireFreshAuth } from "../reauth";

export const settingsRouter = router({
  overview: protectedProcedure.query(async () => {
    const [workspace, connections, members, tokens, webhooks, prefs] = await Promise.all([
      db.select().from(schema.workspace).where(eq(schema.workspace.id, "default")),
      db.select().from(schema.connections).orderBy(schema.connections.category, schema.connections.name),
      db.select().from(schema.members).orderBy(schema.members.role, schema.members.name),
      db.select().from(schema.tokens).orderBy(schema.tokens.created_at),
      db.select().from(schema.webhooks),
      db.select().from(schema.prefs).where(eq(schema.prefs.id, "default")),
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
      connections: connections.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        status: c.status as "connected" | "needs-attention" | "disconnected",
        detail: c.detail,
        fields: c.fields,
        last_sync: c.last_sync,
        health: c.health,
      })),
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
      webhooks: webhooks.map((w) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        status: w.status,
        delivery_stats: w.delivery_stats,
      })),
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
      // prefs is a singleton row; upsert in case it hasn't been seeded yet
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
  // Tokens — revoke. Create lives in P7.
  // ===========================================================================

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
  // Webhooks — edit + delete + toggle
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
