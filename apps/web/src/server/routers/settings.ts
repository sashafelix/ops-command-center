import { z } from "zod";
import { eq } from "drizzle-orm";
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
