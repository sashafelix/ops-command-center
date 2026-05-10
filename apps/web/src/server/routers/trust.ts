import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";

export const trustRouter = router({
  overview: protectedProcedure.query(() => mockStore.trust),
});
