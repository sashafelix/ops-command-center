import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";

export const reportsRouter = router({
  overview: protectedProcedure.query(() => mockStore.reports),
});
