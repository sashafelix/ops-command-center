import { router } from "../trpc";
import { liveRouter } from "./live";
import { sessionsRouter } from "./sessions";
import { approvalsRouter } from "./approvals";
import { infraRouter } from "./infra";
import { statusPageRouter } from "./status-page";
import { agentsRouter } from "./agents";
import { evalsRouter } from "./evals";
import { budgetsRouter } from "./budgets";
import { authRouter } from "./auth";
import { trustRouter } from "./trust";
import { auditLogRouter } from "./audit-log";
import { reportsRouter } from "./reports";
import { settingsRouter } from "./settings";

export const appRouter = router({
  auth: authRouter,
  live: liveRouter,
  sessions: sessionsRouter,
  approvals: approvalsRouter,
  infra: infraRouter,
  statusPage: statusPageRouter,
  agents: agentsRouter,
  evals: evalsRouter,
  budgets: budgetsRouter,
  trust: trustRouter,
  auditLog: auditLogRouter,
  reports: reportsRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
