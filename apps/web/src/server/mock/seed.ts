/**
 * Phase 1 seed data — lifted from Reference_Folder/Ops Dashboard.html STATE.
 * Extended for §5 entities the mock omits (full Approval lifecycle, AuditEvent
 * chain, EvidenceEvent). Successive phases grow this and migrate it to a real
 * backend.
 */

import type {
  Session,
  Approval,
  Notification,
  AuditEvent,
} from "@ops/shared";

const NOW_ISO = new Date().toISOString();

export const seed = {
  nowPlaying: {
    id: "sess_8c1a",
    agent: "claude-code",
    model: "sonnet-4.5",
    repo: "platform/auth-service",
    goal: "Refactor auth middleware to support session rotation",
    runtime_s: 252,
    cost_usd: 0.83,
    tools: 14,
    trust_score: 0.97,
    current_step: "edit_file · src/middleware/session.ts:142",
  },

  kpi: {
    spend24h: 184.27,
    spendPrev: 162.04,
    sessions24h: 612,
    toolCalls24h: 18429,
    avgTrust: 0.94,
    p95LatencyS: 4.2,
  },

  navBadges: {
    live: 0,
    sessions: 0,
    approvals: 5,
    infra: 1,
    "status-page": 0,
    agents: 0,
    evals: 2,
    budgets: 0,
    trust: 2,
    "audit-log": 0,
    reports: 0,
    settings: 0,
  } as Record<string, number>,

  sessions: [] as Session[],
  approvals: [] as Approval[],
  notifications: [] as Notification[],
  auditEvents: [] as AuditEvent[],
};

export type Seed = typeof seed;
