import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";

export const statusPageRouter = router({
  /** mode='public' filters to publicly-visible signals + incidents only. */
  overview: protectedProcedure
    .input(z.object({ mode: z.enum(["internal", "public"]).default("internal") }).optional())
    .query(({ input }) => {
      const data = mockStore.statusPage;
      if (input?.mode === "public") {
        return {
          ...data,
          privateSignals: [],
          incidents: data.incidents.filter((i) => i.public),
        };
      }
      return data;
    }),
});
