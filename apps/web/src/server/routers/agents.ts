import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";

export const agentsRouter = router({
  overview: protectedProcedure.query(() => mockStore.agents),

  /** Phase 3: stub. Phase 4 wires re-auth gate + audit-event write. */
  rollback: protectedProcedure
    .input(z.object({ deploy_id: z.string() }))
    .mutation(({ input }) => {
      const dep = mockStore.agents.deploys.find((d) => d.id === input.deploy_id);
      if (!dep) throw new TRPCError({ code: "NOT_FOUND" });
      dep.status = "rolled-back";
      return { id: dep.id, status: dep.status };
    }),
});
