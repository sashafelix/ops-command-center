import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";

let runCounter = 1000;

export const evalsRouter = router({
  overview: protectedProcedure.query(() => mockStore.evals),

  /**
   * Returns a fake job id; clients show a toast and poll runStatus.
   * Phase 6 wires real eval execution; Phase 4 writes the audit event.
   */
  runSuite: protectedProcedure
    .input(z.object({ suite_id: z.string() }))
    .mutation(({ input }) => {
      runCounter += 1;
      return {
        run_id: `run_${runCounter.toString(36)}`,
        suite_id: input.suite_id,
        status: "queued" as const,
      };
    }),
});
