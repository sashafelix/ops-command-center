import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

/**
 * Workspace runtime state — surfaces the "Pause all agents" kill switch from
 * HANDOFF §6. Pausing flips the flag, writes an audit event; Phase 9 will
 * additionally broadcast a `pause` over WS to the agent runtime.
 */
export const runtimeRouter = router({
  state: protectedProcedure.query(async () => {
    const [row] = await db.select().from(schema.runtime).where(eq(schema.runtime.id, "default"));
    return {
      paused: row?.paused ?? false,
      paused_at: row?.paused_at?.toISOString(),
      paused_by: row?.paused_by ?? undefined,
    };
  }),

  pauseAll: adminProcedure
    .input(z.object({ paused: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const paused_at = input.paused ? new Date() : null;
      const paused_by = input.paused ? (ctx.session.user.email ?? "unknown") : null;

      await db
        .insert(schema.runtime)
        .values({ id: "default", paused: input.paused, paused_at, paused_by })
        .onConflictDoUpdate({
          target: schema.runtime.id,
          set: { paused: input.paused, paused_at, paused_by },
        });

      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: input.paused ? "runtime.pause-all" : "runtime.resume-all",
        target: "workspace/runtime",
      });

      return {
        paused: input.paused,
        paused_at: paused_at?.toISOString(),
        paused_by: paused_by ?? undefined,
      };
    }),
});
