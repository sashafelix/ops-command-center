import { router } from "../trpc";
import { liveRouter } from "./live";
import { sessionsRouter } from "./sessions";
import { approvalsRouter } from "./approvals";

export const appRouter = router({
  live: liveRouter,
  sessions: sessionsRouter,
  approvals: approvalsRouter,
});

export type AppRouter = typeof appRouter;
