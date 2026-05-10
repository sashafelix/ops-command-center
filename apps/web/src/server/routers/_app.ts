import { router } from "../trpc";
import { liveRouter } from "./live";
import { sessionsRouter } from "./sessions";
import { approvalsRouter } from "./approvals";
import { infraRouter } from "./infra";
import { statusPageRouter } from "./status-page";
import { agentsRouter } from "./agents";
import { evalsRouter } from "./evals";
import { budgetsRouter } from "./budgets";

export const appRouter = router({
  live: liveRouter,
  sessions: sessionsRouter,
  approvals: approvalsRouter,
  infra: infraRouter,
  statusPage: statusPageRouter,
  agents: agentsRouter,
  evals: evalsRouter,
  budgets: budgetsRouter,
});

export type AppRouter = typeof appRouter;
