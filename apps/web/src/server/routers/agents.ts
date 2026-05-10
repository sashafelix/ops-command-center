import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

export const agentsRouter = router({
  overview: protectedProcedure.query(() => mockStore.agents),

  /** Destructive — re-auth + audit-event write. */
  rollback: protectedProcedure
    .input(z.object({ deploy_id: z.string() }))
    .mutation(({ input, ctx }) => {
      requireFreshAuth(ctx);
      const dep = mockStore.agents.deploys.find((d) => d.id === input.deploy_id);
      if (!dep) throw new TRPCError({ code: "NOT_FOUND" });
      dep.status = "rolled-back";
      appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "agent.rollback",
        target: `deploy/${dep.id}`,
      });
      return { id: dep.id, status: dep.status };
    }),
});
