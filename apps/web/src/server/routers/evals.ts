import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

let runCounter = 1000;

export const evalsRouter = router({
  overview: protectedProcedure.query(() => mockStore.evals),

  /**
   * Returns a fake job id; clients show a toast and poll runStatus.
   * Destructive (consumes budget) — re-auth + audit-event write.
   */
  runSuite: protectedProcedure
    .input(z.object({ suite_id: z.string() }))
    .mutation(({ input, ctx }) => {
      requireFreshAuth(ctx);
      runCounter += 1;
      const run_id = `run_${runCounter.toString(36)}`;
      appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "evals.run",
        target: `suite/${input.suite_id}`,
      });
      return {
        run_id,
        suite_id: input.suite_id,
        status: "queued" as const,
      };
    }),
});
