import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";

export const budgetsRouter = router({
  overview: protectedProcedure.query(() => mockStore.budgets),
});
