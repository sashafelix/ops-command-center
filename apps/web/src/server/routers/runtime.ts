import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

/**
 * Workspace runtime state — currently surfaces the "Pause all agents" kill
 * switch from HANDOFF §6. Pausing flips the flag and writes an audit event;
 * the production wiring (Phase 6) will additionally broadcast a `pause` over
 * WS to the agent runtime.
 */
export const runtimeRouter = router({
  state: protectedProcedure.query(() => mockStore.runtime),

  pauseAll: adminProcedure
    .input(z.object({ paused: z.boolean() }))
    .mutation(({ input, ctx }) => {
      requireFreshAuth(ctx);
      mockStore.runtime.paused = input.paused;
      mockStore.runtime.paused_at = input.paused ? new Date().toISOString() : undefined;
      mockStore.runtime.paused_by = input.paused ? (ctx.session.user.email ?? "unknown") : undefined;

      appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: input.paused ? "runtime.pause-all" : "runtime.resume-all",
        target: "workspace/runtime",
      });

      return mockStore.runtime;
    }),
});
