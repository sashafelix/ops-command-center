import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";

export const sessionsRouter = router({
  /** Live board: 4 columns of session data + KPI counts. */
  liveBoard: protectedProcedure.query(() => ({
    counts: {
      active: mockStore.active.length,
      watching: mockStore.watching.length,
      done1h: mockStore.done.length,
    },
    active: mockStore.active,
    watching: mockStore.watching,
    done: mockStore.done,
  })),

  /** Sessions list — virtualized on the client. */
  list: protectedProcedure.query(() => mockStore.sessionsTable),

  /** Session detail receipt for the overlay / direct route. */
  detail: protectedProcedure.input(z.object({ id: z.string() })).query(({ input }) => {
    if (input.id === mockStore.receipt.id) return mockStore.receipt;
    // Phase 2: return a derived receipt for any known session id; future phases
    // serve real receipts per session.
    const known = [
      ...mockStore.active,
      ...mockStore.watching,
      ...mockStore.sessionsTable,
    ].find((s) => s.id === input.id);
    if (!known) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      ...mockStore.receipt,
      id: known.id,
      goal: known.goal,
      agent: "agent" in known ? known.agent : mockStore.receipt.agent,
    };
  }),
});
