import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";

export const infraRouter = router({
  overview: protectedProcedure.query(() => mockStore.infra),
});
