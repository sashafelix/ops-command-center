import { router } from "../trpc";
import { liveRouter } from "./live";

export const appRouter = router({
  live: liveRouter,
});

export type AppRouter = typeof appRouter;
