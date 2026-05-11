/**
 * Seed data lifted from Reference_Folder/Ops Dashboard.html STATE and extended
 * for HANDOFF §5 entities the mock omits (full Approval lifecycle, AuditEvent
 * chain, EvidenceEvent). Successive phases grow this; eventually it migrates
 * to a real backend.
 */

import { createHash } from "node:crypto";

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const SEC_MS = 1000;

const now = Date.now();
const isoMinus = (ms: number) => new Date(now - ms).toISOString();
const isoPlus = (ms: number) => new Date(now + ms).toISOString();

export type ActiveSession = {
  id: string;
  status: "ok" | "warn" | "bad" | "idle";
  agent: string;
  model: string;
  repo: string;
  goal: string;
  runtime_s: number;
  cost_usd: number;
  tools: number;
  trust_score: number;
  step: string;
  spark: number[];
  pinned: boolean;
  hot: boolean;
};

export type WatchingSession = ActiveSession & { reason: string };

export type DoneSession = {
  id: string;
  status: "ok" | "warn" | "bad" | "idle";
  goal: string;
  agent: string;
  cost_usd: number;
  tools: number;
  duration: string;
  when: string;
  trust_score: number;
};

export type SessionsRow = {
  id: string;
  status: "ok" | "warn" | "bad" | "idle";
  agent: string;
  model: string;
  goal: string;
  duration: string;
  cost_usd: number;
  tools: number;
  trust_score: number;
  when: string;
};

export type Receipt = {
  id: string;
  agent: string;
  model: string;
  repo: string;
  branch: string;
  operator: string;
  started_at: string;
  runtime_s: number;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  tools: number;
  trust_score: number;
  outcome: "in-progress" | "success" | "aborted" | "failed";
  goal: string;
  timeline: Array<{
    t: string;
    kind: string;
    name: string;
    cost_usd: number;
    latency_ms: number;
    note: string;
    current?: boolean;
  }>;
  artifacts: Array<{ kind: string; name: string; delta: string; bytes: string }>;
  signals: Array<{ label: string; value: string; tone: "ok" | "warn" | "bad" | "info"; note: string }>;
};

export type ApprovalRow = {
  id: string;
  severity: "low" | "med" | "high";
  policy: string;
  agent: string;
  session_id: string;
  goal: string;
  action: string;
  command: string;
  justification: string;
  blast_radius: string;
  auto_deny_at: string;
  requested_at: string;
  requires: number;
  of: number;
};

export type RecentVerdict = {
  id: string;
  verdict: "approved" | "denied" | "edited" | "expired";
  by: string;
  when: string;
  what: string;
  session_id: string;
};

export type PolicyRow = {
  id: string;
  name: string;
  surface: string;
  mode: "always-ask" | "ask-once" | "auto-approve" | "ask-if-unsigned";
  enabled: boolean;
};

export type Region = {
  id: string;
  name: string;
  status: "ok" | "warn" | "bad";
  nodes: string;
  az: number;
  cost_per_hour: string;
  traffic_pct: number;
};

export type ServiceRow = {
  id: string;
  name: string;
  stack: string;
  region: string;
  status: "ok" | "warn" | "bad";
  replicas: string;
  cpu_pct: number;
  mem_pct: number;
  rps: number;
  error_pct: number;
  p95_ms: number;
  version: string;
  reason?: string;
};

export type IncidentRow = {
  id: string;
  severity: "low" | "med" | "high";
  title: string;
  service_id: string;
  age: string;
  assignee: string;
  status: "investigating" | "monitoring" | "resolved";
};

export type DeployRow = {
  id: string;
  version: string;
  service: string;
  who: string;
  when: string;
  status: "ok" | "warn" | "bad";
  rollback_candidate: boolean;
};

export type SLORow = {
  id: string;
  name: string;
  target: string;
  actual: string;
  burn_rate: string;
  state: "ok" | "warn" | "bad";
};

export type PublicSignal = {
  id: string;
  name: string;
  state: "ok" | "warn" | "bad";
  uptime: string;
  last_incident: string;
  uptime90: number[];
};

export type PrivateSignal = {
  id: string;
  name: string;
  state: "ok" | "warn" | "bad";
  note: string;
};

export type StatusIncident = {
  id: string;
  title: string;
  state: "investigating" | "monitoring" | "resolved";
  started_at: string;
  updates: number;
  public: boolean;
};

export type AgentRow = {
  id: string;
  version: string;
  channel: "stable" | "canary" | "shadow";
  status: "active" | "paused" | "drained";
  model: string;
  owner: string;
  trust: number;
  runs_24h: number;
  cost_24h: number;
  p95_s: number;
  tools: string[];
  rate_per_min: number;
  budget: number;
  signed: boolean;
  drift: number;
  spark: number[];
};

export type AgentDeploy = {
  id: string;
  agent: string;
  from: string;
  to: string;
  channel: "stable" | "canary" | "shadow";
  who: string;
  when: string;
  status: "rolled-out" | "rolling" | "rolled-back";
  eval_delta: string;
  cost_delta: string;
};

export type SigningKey = {
  fingerprint: string;
  agent: string;
  algo: "ed25519" | "rsa-4096";
  sigs_24h: number;
  last_used: string;
};

export type EvalSuiteRow = {
  id: string;
  cases: number;
  pass_rate: number;
  delta: number;
  last: string;
  baseline: number;
  model: string;
  flake_rate: number;
  status: "ok" | "warn" | "bad";
  trend: number[];
};

export type EvalRegression = {
  id: string;
  suite: string;
  case: string;
  model: string;
  first_fail: string;
  occurrences: number;
  owner: string;
  commit: string;
};

export type EvalAB = {
  name: string;
  a: { label: string; wins: number; score: number };
  b: { label: string; wins: number; score: number };
  trials: string;
  significance: string;
};

export type TeamBudget = {
  id: string;
  label: string;
  spend_24h: number;
  cap: number;
  mtd: number;
  cap_mtd: number;
  agents: number;
  runs: number;
  trend: string;
  spark: number[];
  status: "ok" | "warn" | "bad";
};

export type BudgetBreach = {
  id: string;
  team: string;
  cap: string;
  amount: string;
  when: string;
  action: string;
  resolved: boolean;
};

export type TopRun = {
  id: string;
  goal: string;
  agent: string;
  cost_usd: number;
  duration: string;
  when: string;
  status: "ok" | "warn" | "bad" | "aborted";
};

export type ThreatRow = {
  category: string;
  /** 24 buckets, value 0..1 normalized to 5-level heat. */
  values: number[];
  total: number;
};

export type InvestigationRow = {
  id: string;
  severity: "low" | "med" | "high";
  title: string;
  session_id: string;
  age: string;
  evidence_status: "pending" | "verified" | "tampered";
  status: "open" | "triage" | "closed";
};

export type EvidenceStreamRow = {
  id: string;
  session_id: string;
  kind: string;
  hash: string;
  signed: boolean;
  signed_by?: string;
  at: string;
};

export type ScheduledReport = {
  id: string;
  name: string;
  cadence: string;
  next_run: string;
  recipients: string[];
  format: "PDF" | "CSV" | "JSONL";
  last_run: string;
};

export type AdHocReport = {
  id: string;
  name: string;
  by: string;
  when: string;
  size: string;
};

export type ComplianceBundle = {
  id: "soc2" | "iso27001" | "eu-ai-act";
  name: string;
  framework: string;
  /** Sticks per HANDOFF: deterministic-build status. */
  status: "ready" | "stale" | "building";
  last_built: string;
  range: string;
  /** Identity of the byte-deterministic content; same range → same hash. */
  content_hash: string;
};

export type ConnectionField = {
  k: string;
  label: string;
  type: "url" | "secret" | "string" | "bool";
  value: string;
};

export type Connection = {
  id: string;
  name: string;
  category: string;
  status: "connected" | "needs-attention" | "disconnected";
  detail: string;
  fields: ConnectionField[];
  last_sync: string;
  health: "ok" | "warn" | "bad" | "info" | "violet";
};

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "SRE" | "Analyst" | "Viewer";
  mfa: boolean;
  last_seen: string;
};

export type TokenRow = {
  id: string;
  name: string;
  scope: string;
  created_at: string;
  last_used: string;
  expires_at: string;
};

export type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  status: "ok" | "warn" | "bad" | "info" | "violet";
  delivery_stats: string;
};

export type Seed = {
  nowPlaying: {
    id: string;
    agent: string;
    model: string;
    repo: string;
    goal: string;
    runtime_s: number;
    cost_usd: number;
    tools: number;
    trust_score: number;
    current_step: string;
  };
  kpi: {
    spend24h: number;
    spendPrev: number;
    sessions24h: number;
    toolCalls24h: number;
    avgTrust: number;
    p95LatencyS: number;
  };
  navBadges: Record<string, number>;
  active: ActiveSession[];
  watching: WatchingSession[];
  done: DoneSession[];
  sessionsTable: SessionsRow[];
  receipt: Receipt;
  approvals: {
    counts: { pending: number; autoApproved24h: number; blocked24h: number };
    queue: ApprovalRow[];
    recent: RecentVerdict[];
    policies: PolicyRow[];
  };
  infra: {
    kpi: { uptime: string; mttr: string; openIncidents: number; slosBreached: number };
    regions: Region[];
    services: ServiceRow[];
    /** Per-service 60-min CPU% load (0..1 normalized). Length 60. */
    load: Array<{ id: string; values: number[] }>;
    incidents: IncidentRow[];
    deploys: DeployRow[];
    slos: SLORow[];
  };
  statusPage: {
    url: string;
    published: boolean;
    publicSignals: PublicSignal[];
    privateSignals: PrivateSignal[];
    incidents: StatusIncident[];
  };
  agents: {
    kpi: { active: number; paused: number; total: number; avg_trust: number; deploys_24h: number };
    list: AgentRow[];
    deploys: AgentDeploy[];
    keys: SigningKey[];
  };
  evals: {
    kpi: { suites: number; total_cases: number; passing: string; regressions: number; drift: string };
    suites: EvalSuiteRow[];
    regressions: EvalRegression[];
    ab: EvalAB;
  };
  budgets: {
    kpi: {
      spend_24h: number;
      cap_day: number;
      spend_mtd: number;
      cap_month: number;
      forecast: number;
      breaches_30d: number;
    };
    teams: TeamBudget[];
    breaches: BudgetBreach[];
    top_runs: TopRun[];
    /** 31 daily values to current day for the MTD chart. */
    mtd_daily: number[];
    cap_line: number;
  };
  trust: {
    kpi: {
      active_threats: number;
      open_investigations: number;
      signed_pct: string;
      policy_violations_24h: number;
    };
    threats: ThreatRow[];
    investigations: InvestigationRow[];
    evidence: EvidenceStreamRow[];
  };
  reports: {
    kpi: { scheduled: number; delivered_30d: number; ad_hoc: number; bundles: number };
    scheduled: ScheduledReport[];
    ad_hoc: AdHocReport[];
    bundles: ComplianceBundle[];
  };
  settings: {
    general: { workspace_name: string; org_id: string; created_at: string; tier: string };
    connections: Connection[];
    members: MemberRow[];
    tokens: TokenRow[];
    webhooks: WebhookRow[];
    prefs: {
      retention: string;
      timezone: string;
      density: "compact" | "comfortable";
      auto_refresh: boolean;
      ambient_audio: boolean;
      theme: "system" | "dark" | "light";
      language: string;
      experimental: boolean;
    };
    about: { version: string; build_id: string; commit: string; built_at: string };
  };
  /** 1200+ chained audit events. Genesis prev_hash = "" per HANDOFF §5. */
  auditEvents: import("@ops/shared").AuditRow[];
  /** Re-auth marker — last fresh-auth timestamp per user (mock). */
  reauth: Record<string, string>;
  /** Workspace-wide runtime state — kill switch. */
  runtime: {
    paused: boolean;
    paused_at?: string | undefined;
    paused_by?: string | undefined;
  };
};

export const seed: Seed = {
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
  },

  active: [
    {
      id: "sess_8c1a",
      status: "ok",
      agent: "claude-code",
      model: "sonnet-4.5",
      repo: "platform/auth-service",
      goal: "Refactor auth middleware to support session rotation",
      runtime_s: 252,
      cost_usd: 0.83,
      tools: 14,
      trust_score: 0.97,
      step: "edit_file · session.ts:142",
      spark: [3, 4, 2, 5, 4, 6, 7, 5, 4, 6, 8, 7, 9, 8, 10, 9, 11],
      pinned: true,
      hot: true,
    },
    {
      id: "sess_4f22",
      status: "ok",
      agent: "claude-code",
      model: "sonnet-4.5",
      repo: "platform/embeddings",
      goal: "Backfill embeddings for support corpus",
      runtime_s: 1842,
      cost_usd: 1.94,
      tools: 22,
      trust_score: 0.93,
      step: "bash · pnpm run backfill --shard 4/12",
      spark: [2, 3, 3, 5, 6, 8, 9, 7, 8, 9, 10, 11, 12, 11, 12, 13, 14],
      pinned: false,
      hot: false,
    },
    {
      id: "sess_a771",
      status: "ok",
      agent: "claude-code",
      model: "sonnet-4.5",
      repo: "infra/terraform",
      goal: "Add WAF rule for /api/v1/exports rate-limit",
      runtime_s: 421,
      cost_usd: 0.41,
      tools: 9,
      trust_score: 0.95,
      step: "read_file · waf.tf:88",
      spark: [4, 4, 4, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7],
      pinned: false,
      hot: false,
    },
    {
      id: "sess_b14c",
      status: "warn",
      agent: "claude-code",
      model: "sonnet-4.5",
      repo: "platform/billing",
      goal: "Reconcile Stripe webhook ledger drift",
      runtime_s: 1842,
      cost_usd: 2.41,
      tools: 38,
      trust_score: 0.71,
      step: "flagged · prompt-injection candidate",
      spark: [2, 3, 4, 3, 4, 5, 6, 7, 9, 8, 7, 6, 5, 4, 3, 4, 5],
      pinned: false,
      hot: false,
    },
  ],

  watching: [
    {
      id: "sess_b14c",
      status: "warn",
      agent: "claude-code",
      model: "sonnet-4.5",
      repo: "platform/billing",
      goal: "Reconcile Stripe webhook ledger drift",
      runtime_s: 1842,
      cost_usd: 2.41,
      tools: 38,
      trust_score: 0.71,
      step: "flagged · prompt-injection candidate",
      spark: [2, 3, 4, 3, 4, 5, 6, 7, 9, 8, 7, 6, 5, 4, 3, 4, 5],
      pinned: false,
      hot: false,
      reason: "Soft trust signal — instruction in tool output",
    },
    {
      id: "sess_d099",
      status: "warn",
      agent: "eval-runner",
      model: "sonnet-4.5",
      repo: "evals/auth-suite",
      goal: "Re-run regression suite after middleware refactor",
      runtime_s: 612,
      cost_usd: 0.92,
      tools: 17,
      trust_score: 0.78,
      step: "bash · pnpm test session-rotation",
      spark: [5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
      pinned: false,
      hot: false,
      reason: "2 failing cases since 09:31 — pending triage",
    },
  ],

  done: [
    { id: "sess_3a01", status: "ok",   goal: "Patch CVE-2026-1144 in image-resizer",            agent: "claude-code", cost_usd: 1.42, tools: 31, duration: "18m02s", when: "12 min ago",  trust_score: 0.98 },
    { id: "sess_2c9e", status: "ok",   goal: "Add OpenAPI spec for /v1/exports",                agent: "claude-code", cost_usd: 0.62, tools: 12, duration: "07m41s", when: "21 min ago",  trust_score: 0.96 },
    { id: "sess_91c4", status: "bad",  goal: "Backfill embeddings for support corpus",          agent: "eval-runner", cost_usd: 6.74, tools: 88, duration: "41m08s", when: "31 min ago",  trust_score: 0.62 },
    { id: "sess_57a2", status: "ok",   goal: "Add Slack channel deny-list",                     agent: "claude-code", cost_usd: 0.31, tools: 7,  duration: "04m18s", when: "44 min ago",  trust_score: 0.99 },
    { id: "sess_71b2", status: "warn", goal: "Investigate p95 spike on auth-public",            agent: "claude-code", cost_usd: 1.08, tools: 22, duration: "16m12s", when: "58 min ago",  trust_score: 0.84 },
  ],

  sessionsTable: [
    { id: "sess_8c1a", status: "ok",   agent: "claude-code", model: "sonnet-4.5", goal: "Refactor auth middleware to support session rotation", duration: "—",       cost_usd: 0.83, tools: 14, trust_score: 0.97, when: "live"          },
    { id: "sess_4f22", status: "ok",   agent: "claude-code", model: "sonnet-4.5", goal: "Backfill embeddings for support corpus",                duration: "—",       cost_usd: 1.94, tools: 22, trust_score: 0.93, when: "live"          },
    { id: "sess_a771", status: "ok",   agent: "claude-code", model: "sonnet-4.5", goal: "Add WAF rule for /api/v1/exports rate-limit",          duration: "—",       cost_usd: 0.41, tools: 9,  trust_score: 0.95, when: "live"          },
    { id: "sess_b14c", status: "warn", agent: "claude-code", model: "sonnet-4.5", goal: "Reconcile Stripe webhook ledger drift",                 duration: "—",       cost_usd: 2.41, tools: 38, trust_score: 0.71, when: "live"          },
    { id: "sess_d099", status: "warn", agent: "eval-runner", model: "sonnet-4.5", goal: "Re-run regression suite after middleware refactor",    duration: "—",       cost_usd: 0.92, tools: 17, trust_score: 0.78, when: "live"          },
    { id: "sess_3a01", status: "ok",   agent: "claude-code", model: "sonnet-4.5", goal: "Patch CVE-2026-1144 in image-resizer",                 duration: "18m02s", cost_usd: 1.42, tools: 31, trust_score: 0.98, when: "12 min ago" },
    { id: "sess_2c9e", status: "ok",   agent: "claude-code", model: "sonnet-4.5", goal: "Add OpenAPI spec for /v1/exports",                     duration: "07m41s", cost_usd: 0.62, tools: 12, trust_score: 0.96, when: "21 min ago" },
    { id: "sess_91c4", status: "bad",  agent: "eval-runner", model: "sonnet-4.5", goal: "Backfill embeddings for support corpus",                duration: "41m08s", cost_usd: 6.74, tools: 88, trust_score: 0.62, when: "31 min ago" },
    { id: "sess_57a2", status: "ok",   agent: "claude-code", model: "sonnet-4.5", goal: "Add Slack channel deny-list",                          duration: "04m18s", cost_usd: 0.31, tools: 7,  trust_score: 0.99, when: "44 min ago" },
    { id: "sess_71b2", status: "warn", agent: "claude-code", model: "sonnet-4.5", goal: "Investigate p95 spike on auth-public",                 duration: "16m12s", cost_usd: 1.08, tools: 22, trust_score: 0.84, when: "58 min ago" },
    { id: "sess_402f", status: "ok",   agent: "claude-code", model: "sonnet-4.5", goal: "Generate weekly operations report",                    duration: "11m04s", cost_usd: 0.74, tools: 18, trust_score: 0.97, when: "1h 14m ago" },
    { id: "sess_991a", status: "ok",   agent: "claude-code", model: "sonnet-4.5", goal: "Update API client SDK to v2.7.0",                      duration: "08m22s", cost_usd: 0.49, tools: 11, trust_score: 0.98, when: "1h 32m ago" },
    { id: "sess_15bc", status: "ok",   agent: "claude-code", model: "sonnet-4.5", goal: "Sweep dead webhooks across staging",                    duration: "06m51s", cost_usd: 0.38, tools: 9,  trust_score: 0.97, when: "2h 04m ago" },
  ],

  receipt: {
    id: "sess_8c1a",
    agent: "claude-code",
    model: "sonnet-4.5",
    repo: "platform/auth-service",
    branch: "feat/session-rotation",
    operator: "mara@ops",
    started_at: isoMinus(252 * SEC_MS),
    runtime_s: 252,
    cost_usd: 0.83,
    tokens_in: 184230,
    tokens_out: 12044,
    tools: 14,
    trust_score: 0.97,
    outcome: "in-progress",
    goal: "Refactor auth middleware to support session rotation",
    timeline: [
      { t: "00:00", kind: "prompt",     name: "user prompt",                 cost_usd: 0.0,  latency_ms: 0,    note: "Refactor src/middleware/session.ts to support session rotation per RFC-9114 §3" },
      { t: "00:01", kind: "read_file",  name: "read_file · session.ts",      cost_usd: 0.01, latency_ms: 184,  note: "472 lines" },
      { t: "00:08", kind: "read_file",  name: "read_file · session.test.ts", cost_usd: 0.01, latency_ms: 142,  note: "281 lines" },
      { t: "00:14", kind: "grep",       name: "grep · 'rotateSessionId'",    cost_usd: 0.0,  latency_ms: 88,   note: "3 matches across 2 files" },
      { t: "00:22", kind: "edit_file",  name: "edit_file · session.ts:88",   cost_usd: 0.04, latency_ms: 412,  note: "+18 −4" },
      { t: "00:38", kind: "bash",       name: "bash · pnpm test session",    cost_usd: 0.06, latency_ms: 8412, note: "12 passing · 1 failing" },
      { t: "01:08", kind: "edit_file",  name: "edit_file · session.test.ts", cost_usd: 0.05, latency_ms: 380,  note: "+34 −0" },
      { t: "01:32", kind: "bash",       name: "bash · pnpm test session",    cost_usd: 0.07, latency_ms: 8901, note: "13 passing" },
      { t: "02:01", kind: "edit_file",  name: "edit_file · session.ts:142",  cost_usd: 0.06, latency_ms: 422,  note: "+72 −17", current: true },
    ],
    artifacts: [
      { kind: "diff", name: "session.ts",      delta: "+90 −21", bytes: "18.4 KB" },
      { kind: "diff", name: "session.test.ts", delta: "+34 −0",  bytes: "9.1 KB" },
      { kind: "log",  name: "pnpm-test.log",   delta: "",         bytes: "42.0 KB" },
    ],
    signals: [
      { label: "Trust score",    value: "0.97",          tone: "ok", note: "No injection candidates in tool output" },
      { label: "Policy",         value: "pass",          tone: "ok", note: "No writes outside repo root" },
      { label: "Cost vs budget", value: "$0.83 / $5.00", tone: "ok", note: "17% of cap" },
    ],
  },

  approvals: {
    counts: { pending: 5, autoApproved24h: 142, blocked24h: 3 },
    queue: [
      {
        id: "apr_8821",
        severity: "high",
        policy: "destructive-write",
        agent: "claude-code",
        session_id: "sess_8c1a",
        goal: "Refactor auth middleware to support session rotation",
        action: "bash",
        command: "kubectl -n prod rollout restart deploy/auth-service",
        justification: "Reload pods to pick up rotated session middleware before next deploy window.",
        blast_radius: "Production · 12 pods · expected ~30s p95 spike",
        auto_deny_at: isoPlus(4 * MIN_MS + 18 * SEC_MS),
        requested_at: isoMinus(42 * SEC_MS),
        requires: 1,
        of: 1,
      },
      {
        id: "apr_8822",
        severity: "med",
        policy: "external-network",
        agent: "claude-code",
        session_id: "sess_4f22",
        goal: "Backfill embeddings for support corpus",
        action: "web_fetch",
        command: "GET https://api.openai.com/v1/embeddings (×4221)",
        justification: "Batch fetch embeddings for shard 4/12. ~$2.10 expected cost.",
        blast_radius: "External quota · openai key 'embed-prod'",
        auto_deny_at: isoPlus(8 * MIN_MS + 2 * SEC_MS),
        requested_at: isoMinus(2 * MIN_MS),
        requires: 1,
        of: 1,
      },
      {
        id: "apr_8823",
        severity: "med",
        policy: "destructive-write",
        agent: "claude-code",
        session_id: "sess_a771",
        goal: "Add WAF rule for /api/v1/exports rate-limit",
        action: "bash",
        command: "terraform apply -auto-approve -target=aws_wafv2_rule_group.exports",
        justification: "Apply rate-limit rule generated from waf.tf review.",
        blast_radius: "Edge · all regions · ~5s convergence",
        auto_deny_at: isoPlus(11 * MIN_MS + 41 * SEC_MS),
        requested_at: isoMinus(3 * MIN_MS),
        requires: 1,
        of: 1,
      },
      {
        id: "apr_8824",
        severity: "low",
        policy: "ask-if-unsigned",
        agent: "eval-runner",
        session_id: "sess_d099",
        goal: "Re-run regression suite after middleware refactor",
        action: "edit_file",
        command: "edit_file · evals/auth-suite/snapshots/__rotation__.json",
        justification: "Snapshot diverged after rotateSessionId() change; update baseline.",
        blast_radius: "Eval baselines · auth-suite",
        auto_deny_at: isoPlus(14 * MIN_MS),
        requested_at: isoMinus(5 * MIN_MS),
        requires: 1,
        of: 1,
      },
      {
        id: "apr_8825",
        severity: "high",
        policy: "secret-touch",
        agent: "claude-code",
        session_id: "sess_b14c",
        goal: "Reconcile Stripe webhook ledger drift",
        action: "bash",
        command: "vault kv get -field=key secrets/stripe/webhook-signing",
        justification: "Read webhook signing key to validate ledger entries against incoming events.",
        blast_radius: "Read-only · vault path: secrets/stripe/*",
        auto_deny_at: isoPlus(2 * MIN_MS + 9 * SEC_MS),
        requested_at: isoMinus(8 * MIN_MS),
        requires: 2,
        of: 2,
      },
    ],
    recent: [
      { id: "apr_8816", verdict: "approved", by: "mara@ops",  when: "4 min ago",  what: "bash · pnpm test session",            session_id: "sess_8c1a" },
      { id: "apr_8815", verdict: "denied",   by: "devon@ops", when: "11 min ago", what: "bash · rm -rf node_modules",          session_id: "sess_4f22" },
      { id: "apr_8814", verdict: "approved", by: "mara@ops",  when: "16 min ago", what: "edit_file · auth.ts:18",              session_id: "sess_8c1a" },
      { id: "apr_8813", verdict: "edited",   by: "devon@ops", when: "22 min ago", what: "bash · kubectl apply -f deploy.yaml", session_id: "sess_a771" },
      { id: "apr_8812", verdict: "expired",  by: "—",          when: "31 min ago", what: "web_fetch · slack.com webhook",       session_id: "sess_57a2" },
    ],
    policies: [
      { id: "p_destr",  name: "destructive-write",  surface: "bash, edit_file outside repo, kubectl", mode: "always-ask",    enabled: true },
      { id: "p_secret", name: "secret-touch",       surface: "vault, kms, sops",                       mode: "always-ask",    enabled: true },
      { id: "p_ext",    name: "external-network",   surface: "web_fetch outside allowlist",            mode: "ask-once",      enabled: true },
      { id: "p_unsig",  name: "ask-if-unsigned",    surface: "edit_file in evals/, snapshots/",        mode: "ask-if-unsigned", enabled: true },
      { id: "p_local",  name: "local-bash",         surface: "bash inside repo root",                   mode: "auto-approve",  enabled: true },
      { id: "p_read",   name: "read-only-tools",    surface: "read_file, grep, ls",                     mode: "auto-approve",  enabled: true },
      { id: "p_pkg",    name: "package-install",    surface: "pnpm/npm/yarn add",                       mode: "ask-once",      enabled: false },
    ],
  },

  infra: {
    kpi: { uptime: "99.987%", mttr: "6m41s", openIncidents: 1, slosBreached: 1 },
    regions: [
      { id: "us-east-1",      name: "US East (N. Virginia)", status: "ok",   nodes: "48/48", az: 3, cost_per_hour: "$1.84/h", traffic_pct: 0.62 },
      { id: "us-west-2",      name: "US West (Oregon)",       status: "ok",   nodes: "32/32", az: 3, cost_per_hour: "$1.21/h", traffic_pct: 0.18 },
      { id: "eu-west-1",      name: "EU (Ireland)",            status: "warn", nodes: "23/24", az: 3, cost_per_hour: "$1.02/h", traffic_pct: 0.14 },
      { id: "ap-southeast-1", name: "AP (Singapore)",          status: "ok",   nodes: "16/16", az: 2, cost_per_hour: "$0.62/h", traffic_pct: 0.06 },
    ],
    services: [
      { id: "svc_edge",   name: "edge-gateway",     stack: "edge",      region: "global",       status: "ok",   replicas: "24/24", cpu_pct: 0.31, mem_pct: 0.42, rps: 8420, error_pct: 0.001, p95_ms: 42,  version: "1.42.0" },
      { id: "svc_api",    name: "api-public",       stack: "go",        region: "us-east-1",    status: "ok",   replicas: "16/16", cpu_pct: 0.48, mem_pct: 0.51, rps: 4210, error_pct: 0.002, p95_ms: 88,  version: "4.07.1" },
      { id: "svc_apipri", name: "api-private",      stack: "go",        region: "us-east-1",    status: "ok",   replicas: "12/12", cpu_pct: 0.39, mem_pct: 0.44, rps: 2104, error_pct: 0.001, p95_ms: 71,  version: "4.07.1" },
      { id: "svc_auth",   name: "auth-service",     stack: "rust",      region: "us-east-1",    status: "ok",   replicas: "12/12", cpu_pct: 0.42, mem_pct: 0.38, rps: 1842, error_pct: 0.000, p95_ms: 32,  version: "2.18.4" },
      { id: "svc_embed",  name: "embedding-worker", stack: "python",    region: "us-east-1",    status: "warn", replicas: "8/10",  cpu_pct: 0.81, mem_pct: 0.74, rps: 142,  error_pct: 0.024, p95_ms: 4218, version: "0.94.2", reason: "queue depth 8.4k · 2 workers OOM-restarted in last 5m" },
      { id: "svc_ledger", name: "billing-ledger",   stack: "node",      region: "us-east-1",    status: "ok",   replicas: "6/6",   cpu_pct: 0.22, mem_pct: 0.31, rps: 412,  error_pct: 0.001, p95_ms: 64,  version: "1.12.0" },
      { id: "svc_search", name: "search-public",    stack: "go",        region: "us-east-1",    status: "ok",   replicas: "8/8",   cpu_pct: 0.34, mem_pct: 0.41, rps: 3018, error_pct: 0.002, p95_ms: 91,  version: "3.08.2" },
      { id: "svc_oss",    name: "opensearch",       stack: "java",      region: "us-east-1",    status: "ok",   replicas: "9/9",   cpu_pct: 0.51, mem_pct: 0.62, rps: 1842, error_pct: 0.000, p95_ms: 18,  version: "2.13.0" },
      { id: "svc_kafka",  name: "kafka-events",     stack: "scala",     region: "us-east-1",    status: "ok",   replicas: "6/6",   cpu_pct: 0.44, mem_pct: 0.58, rps: 14012,error_pct: 0.000, p95_ms: 8,   version: "3.7.0" },
      { id: "svc_runner", name: "agent-runner",     stack: "node",      region: "us-east-1",    status: "ok",   replicas: "20/20", cpu_pct: 0.62, mem_pct: 0.57, rps: 412,  error_pct: 0.000, p95_ms: 142, version: "0.42.0" },
      { id: "svc_eu",     name: "api-public-eu",    stack: "go",        region: "eu-west-1",    status: "warn", replicas: "11/12", cpu_pct: 0.71, mem_pct: 0.62, rps: 1208, error_pct: 0.014, p95_ms: 211, version: "4.07.1", reason: "1 pod CrashLoopBackOff · CPU throttling on shared node" },
      { id: "svc_ap",     name: "api-public-ap",    stack: "go",        region: "ap-southeast-1", status: "ok", replicas: "6/6",   cpu_pct: 0.28, mem_pct: 0.34, rps: 421,  error_pct: 0.000, p95_ms: 64,  version: "4.07.1" },
    ],
    load: [
      { id: "svc_edge",   values: minuteSeries(60, 0.30, 0.06) },
      { id: "svc_api",    values: minuteSeries(60, 0.48, 0.08) },
      { id: "svc_auth",   values: minuteSeries(60, 0.42, 0.07) },
      { id: "svc_embed",  values: minuteSeries(60, 0.78, 0.16, 0.95) },
      { id: "svc_search", values: minuteSeries(60, 0.34, 0.06) },
      { id: "svc_runner", values: minuteSeries(60, 0.60, 0.10) },
    ],
    incidents: [
      { id: "inc_71", severity: "high", title: "embedding-worker queue depth backing up", service_id: "svc_embed", age: "14 min", assignee: "on-call: kai",   status: "investigating" },
      { id: "inc_70", severity: "med",  title: "EU public API CPU throttling on shared node", service_id: "svc_eu", age: "42 min", assignee: "on-call: kai", status: "monitoring" },
    ],
    deploys: [
      { id: "dep_4421", version: "4.07.1", service: "api-public",       who: "mara",  when: "18 min ago", status: "ok",   rollback_candidate: false },
      { id: "dep_4420", version: "0.94.2", service: "embedding-worker", who: "devon", when: "32 min ago", status: "warn", rollback_candidate: true  },
      { id: "dep_4419", version: "2.18.4", service: "auth-service",     who: "mara",  when: "1 h ago",    status: "ok",   rollback_candidate: false },
      { id: "dep_4418", version: "0.42.0", service: "agent-runner",     who: "devon", when: "2 h ago",    status: "ok",   rollback_candidate: false },
    ],
    slos: [
      { id: "slo_api_avail",  name: "api-public · availability",   target: "99.95%", actual: "99.99%", burn_rate: "0.04", state: "ok"   },
      { id: "slo_api_p95",    name: "api-public · p95 latency",     target: "<150ms", actual: "88ms",   burn_rate: "0.61", state: "ok"   },
      { id: "slo_embed_p95",  name: "embedding-worker · p95",        target: "<2s",    actual: "4.2s",   burn_rate: "9.42", state: "bad"  },
      { id: "slo_auth_avail", name: "auth-service · availability",  target: "99.99%", actual: "100.00%", burn_rate: "0.00", state: "ok"  },
      { id: "slo_search_p95", name: "search-public · p95",           target: "<200ms", actual: "91ms",   burn_rate: "0.46", state: "ok"   },
      { id: "slo_eu_avail",   name: "api-public-eu · availability", target: "99.95%", actual: "99.74%", burn_rate: "1.84", state: "warn" },
    ],
  },

  statusPage: {
    url: "status.anthropic-ops.com",
    published: true,
    publicSignals: [
      { id: "p_api",    name: "API ingestion",      state: "ok",   uptime: "99.998%", last_incident: "7 days ago",  uptime90: uptimeStrip(90, 0.998) },
      { id: "p_search", name: "Search public",      state: "ok",   uptime: "99.992%", last_incident: "14 days ago", uptime90: uptimeStrip(90, 0.995) },
      { id: "p_auth",   name: "Authentication",     state: "ok",   uptime: "99.999%", last_incident: "31 days ago", uptime90: uptimeStrip(90, 0.999) },
      { id: "p_dash",   name: "Dashboard",          state: "ok",   uptime: "99.971%", last_incident: "9 days ago",  uptime90: uptimeStrip(90, 0.99) },
      { id: "p_recv",   name: "Receipts search",    state: "warn", uptime: "99.842%", last_incident: "active",       uptime90: uptimeStrip(90, 0.98, 4) },
    ],
    privateSignals: [
      { id: "i_kafka",   name: "Kafka — events",            state: "warn", note: "lag 1.2s on partition 4" },
      { id: "i_oss",     name: "OpenSearch — receipts",     state: "ok",   note: "shard rebalance complete · 09:18Z" },
      { id: "i_runner",  name: "Agent runner — schedulers", state: "ok",   note: "all 20 replicas healthy" },
      { id: "i_vault",   name: "Vault — secrets",            state: "ok",   note: "leases renewed · 09:32Z" },
    ],
    incidents: [
      { id: "inc_42", title: "Receipt search degraded",                 state: "monitoring",   started_at: "09:18 UTC", updates: 3, public: true  },
      { id: "inc_41", title: "Brief auth latency spike on us-east-1",   state: "resolved",     started_at: "Yesterday", updates: 5, public: true  },
      { id: "inc_40", title: "OpenSearch shard rebalance — internal",   state: "resolved",     started_at: "Yesterday", updates: 2, public: false },
    ],
  },

  agents: {
    kpi: { active: 4, paused: 1, total: 6, avg_trust: 0.94, deploys_24h: 3 },
    list: [
      { id: "claude-code",  version: "0.42",   channel: "stable", status: "active", model: "sonnet-4.5",   owner: "platform", trust: 0.97, runs_24h: 412, cost_24h: 104.18, p95_s: 4.2, tools: ["read_file","edit_file","bash","grep","web_fetch"], rate_per_min: 120, budget: 200.00, signed: true,  drift: 0,    spark: [5,6,5,7,6,8,7,9,8,7,9,10,9,11,10,12,11,12] },
      { id: "eval-runner",  version: "1.18",   channel: "stable", status: "active", model: "sonnet-4.5",   owner: "evals",    trust: 0.94, runs_24h: 142, cost_24h: 38.42,  p95_s: 7.8, tools: ["read_file","bash"],                              rate_per_min: 24,  budget: 80.00,  signed: true,  drift: 0.01, spark: [3,3,4,4,5,5,4,5,5,6,6,5,6,5,6,7,7,7] },
      { id: "auto-triage",  version: "0.4",    channel: "canary", status: "active", model: "haiku-4.5",    owner: "ops",      trust: 0.91, runs_24h: 248, cost_24h: 21.94,  p95_s: 1.4, tools: ["read_file","grep"],                              rate_per_min: 60,  budget: 60.00,  signed: true,  drift: 0,    spark: [2,2,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6,6] },
      { id: "doc-summarize",version: "0.7-rc", channel: "shadow", status: "active", model: "haiku-4.5",    owner: "docs",     trust: 0.89, runs_24h: 88,  cost_24h: 6.21,   p95_s: 2.0, tools: ["read_file"],                                     rate_per_min: 18,  budget: 30.00,  signed: false, drift: 0.04, spark: [1,1,2,2,2,2,3,3,3,3,3,4,4,4,4,4,5,5] },
      { id: "release-bot",  version: "2.01",   channel: "stable", status: "paused", model: "sonnet-4.5",   owner: "platform", trust: 0.96, runs_24h: 0,   cost_24h: 0.00,   p95_s: 0,   tools: ["read_file","edit_file","bash"],                  rate_per_min: 0,   budget: 50.00,  signed: true,  drift: 0,    spark: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { id: "test-runner",  version: "0.18",   channel: "stable", status: "active", model: "haiku-4.5",    owner: "platform", trust: 0.93, runs_24h: 312, cost_24h: 13.52,  p95_s: 0.8, tools: ["bash"],                                          rate_per_min: 90,  budget: 30.00,  signed: true,  drift: 0,    spark: [4,4,5,5,5,5,5,6,6,6,6,7,7,7,7,7,8,8] },
    ],
    deploys: [
      { id: "dep_4421", agent: "claude-code", from: "0.41",   to: "0.42",   channel: "stable", who: "devon@ops", when: "4 h ago",    status: "rolled-out",  eval_delta: "+0.4%",  cost_delta: "-3.1%" },
      { id: "dep_4420", agent: "auto-triage", from: "0.3",    to: "0.4",    channel: "canary", who: "mara@ops",  when: "8 h ago",    status: "rolled-out",  eval_delta: "+1.2%",  cost_delta: "-12.4%" },
      { id: "dep_4419", agent: "test-runner", from: "0.17",   to: "0.18",   channel: "stable", who: "devon@ops", when: "1 d ago",    status: "rolled-out",  eval_delta: "0.0%",   cost_delta: "+0.0%" },
    ],
    keys: [
      { fingerprint: "b8:c4:1e:7a:91:ff:24:0d:…", agent: "claude-code", algo: "ed25519", sigs_24h: 412, last_used: "12s ago" },
      { fingerprint: "f2:18:0b:33:c1:42:9e:01:…", agent: "eval-runner", algo: "ed25519", sigs_24h: 142, last_used: "2 min ago" },
      { fingerprint: "a4:e9:71:5c:08:bd:33:ff:…", agent: "auto-triage", algo: "ed25519", sigs_24h: 248, last_used: "44s ago" },
    ],
  },

  evals: {
    kpi: { suites: 14, total_cases: 2842, passing: "97.4%", regressions: 2, drift: "-0.6%" },
    suites: [
      { id: "auth-suite",     cases: 184, pass_rate: 0.952, delta: -0.011, last: "12 min ago", baseline: 0.963, model: "sonnet-4.5", flake_rate: 0.012, status: "warn", trend: [97,97,96,97,97,96,97,96,96,95,96,95,95,95] },
      { id: "billing-suite",  cases: 142, pass_rate: 0.978, delta:  0.000, last: "21 min ago", baseline: 0.978, model: "sonnet-4.5", flake_rate: 0.008, status: "ok",   trend: [98,98,98,98,98,98,98,98,98,98,98,98,98,98] },
      { id: "search-suite",   cases: 312, pass_rate: 0.988, delta:  0.002, last: "31 min ago", baseline: 0.986, model: "sonnet-4.5", flake_rate: 0.004, status: "ok",   trend: [98,99,98,99,98,99,99,98,99,99,99,99,99,99] },
      { id: "tool-use-suite", cases: 488, pass_rate: 0.961, delta: -0.004, last: "44 min ago", baseline: 0.965, model: "sonnet-4.5", flake_rate: 0.018, status: "ok",   trend: [96,96,96,96,96,97,96,96,96,96,96,96,96,96] },
      { id: "infra-suite",    cases: 218, pass_rate: 0.991, delta:  0.000, last: "1 h ago",    baseline: 0.991, model: "sonnet-4.5", flake_rate: 0.005, status: "ok",   trend: [99,99,99,99,99,99,99,99,99,99,99,99,99,99] },
      { id: "long-tail-suite",cases: 412, pass_rate: 0.917, delta: -0.022, last: "2 h ago",    baseline: 0.939, model: "sonnet-4.5", flake_rate: 0.041, status: "bad",  trend: [94,94,93,94,93,94,93,93,92,92,91,92,92,91] },
      { id: "policy-suite",   cases: 144, pass_rate: 0.999, delta:  0.000, last: "3 h ago",    baseline: 0.999, model: "sonnet-4.5", flake_rate: 0.001, status: "ok",   trend: [99,99,99,99,99,99,99,99,99,99,99,99,99,99] },
      { id: "trust-suite",    cases: 188, pass_rate: 0.972, delta: -0.001, last: "4 h ago",    baseline: 0.973, model: "sonnet-4.5", flake_rate: 0.011, status: "ok",   trend: [97,97,97,97,97,97,97,97,97,97,97,97,97,97] },
    ],
    regressions: [
      { id: "r_412", suite: "auth-suite",       case: "rotates session id mid-request",   model: "sonnet-4.5", first_fail: "12 min ago", occurrences: 2, owner: "platform", commit: "b8c41e7" },
      { id: "r_411", suite: "long-tail-suite",  case: "handles 16k-token tool output",     model: "sonnet-4.5", first_fail: "2 h ago",     occurrences: 4, owner: "platform", commit: "a14ee02" },
    ],
    ab: {
      name: "sonnet-4.5 vs sonnet-5-rc",
      a: { label: "sonnet-4.5", wins: 412, score: 97.4 },
      b: { label: "sonnet-5-rc", wins: 438, score: 98.6 },
      trials: "12,840 trials",
      significance: "p < 0.001",
    },
  },

  budgets: {
    kpi: { spend_24h: 184.27, cap_day: 240.00, spend_mtd: 3284.10, cap_month: 6000.00, forecast: 5872.00, breaches_30d: 1 },
    teams: [
      { id: "platform", label: "platform", spend_24h: 104.18, cap: 120.00, mtd: 1842.31, cap_mtd: 2400.00, agents: 2, runs: 412, trend: "+13%", spark: [80,82,86,90,94,98,102,104], status: "warn" },
      { id: "ops",      label: "ops",      spend_24h: 21.94,  cap: 60.00,  mtd: 612.04,  cap_mtd: 1200.00, agents: 1, runs: 248, trend: "-4%",  spark: [22,24,23,22,21,22,22,22],     status: "ok"   },
      { id: "evals",    label: "evals",    spend_24h: 38.42,  cap: 80.00,  mtd: 612.18,  cap_mtd: 1600.00, agents: 1, runs: 142, trend: "+2%",  spark: [38,38,39,40,40,38,38,38],     status: "ok"   },
      { id: "docs",     label: "docs",     spend_24h: 6.21,   cap: 30.00,  mtd: 88.18,   cap_mtd: 600.00,  agents: 1, runs: 88,  trend: "0%",   spark: [6,6,6,6,7,6,6,6],              status: "ok"   },
      { id: "billing",  label: "billing",  spend_24h: 13.52,  cap: 30.00,  mtd: 129.39,  cap_mtd: 600.00,  agents: 1, runs: 312, trend: "+1%",  spark: [13,13,14,14,13,13,13,14],     status: "ok"   },
    ],
    breaches: [
      { id: "br_701", team: "platform", cap: "$200 / day", amount: "$214.02", when: "May 6", action: "paused agents · 18m", resolved: true },
    ],
    top_runs: [
      { id: "sess_91c4", goal: "Backfill embeddings for support corpus",    agent: "eval-runner",  cost_usd: 6.74, duration: "41m08s", when: "31 min ago",  status: "aborted" },
      { id: "sess_8c1a", goal: "Refactor auth middleware (session rotation)", agent: "claude-code", cost_usd: 0.83, duration: "—",      when: "live",         status: "ok"      },
      { id: "sess_4f22", goal: "Backfill embeddings for support corpus",    agent: "claude-code", cost_usd: 1.94, duration: "—",      when: "live",         status: "ok"      },
      { id: "sess_b14c", goal: "Reconcile Stripe webhook ledger drift",      agent: "claude-code", cost_usd: 2.41, duration: "—",      when: "live",         status: "warn"    },
      { id: "sess_3a01", goal: "Patch CVE-2026-1144 in image-resizer",       agent: "claude-code", cost_usd: 1.42, duration: "18m02s", when: "12 min ago",   status: "ok"      },
    ],
    mtd_daily: [80,82,85,88,86,90,92,95,98,102,108,112,118,124,131,138,146,154,162,170,178,186,184],
    cap_line: 200,
  },

  trust: {
    kpi: {
      active_threats: 0,
      open_investigations: 2,
      signed_pct: "99.6%",
      policy_violations_24h: 3,
    },
    threats: [
      { category: "Prompt injection",      values: heatRow(24, 1, 4),  total: 1 },
      { category: "Data exfiltration",     values: heatRow(24, 2, 3),  total: 0 },
      { category: "Policy violation",      values: heatRow(24, 3, 7),  total: 3 },
      { category: "Tool misuse",            values: heatRow(24, 1, 11), total: 1 },
      { category: "Supply chain",           values: heatRow(24, 0, 0),  total: 0 },
      { category: "Identity drift",         values: heatRow(24, 0, 0),  total: 0 },
      { category: "Output anomaly",         values: heatRow(24, 2, 2),  total: 2 },
    ],
    investigations: [
      { id: "inv_204", severity: "med",  title: "Instruction-in-output candidate", session_id: "sess_b14c", age: "7 min",  evidence_status: "verified", status: "open"   },
      { id: "inv_203", severity: "low",  title: "Anomalous tool-use pattern",       session_id: "sess_71b2", age: "58 min", evidence_status: "verified", status: "triage" },
    ],
    evidence: [
      { id: "evt_99201", session_id: "sess_8c1a", kind: "prompt",     hash: "b8…c41", signed: true,  signed_by: "claude-code/0.42", at: "09:38:06Z" },
      { id: "evt_99200", session_id: "sess_8c1a", kind: "edit_file",  hash: "f2…980", signed: true,  signed_by: "claude-code/0.42", at: "09:39:12Z" },
      { id: "evt_99199", session_id: "sess_b14c", kind: "tool_output",hash: "a4…71d", signed: false,                                  at: "09:40:03Z" },
      { id: "evt_99198", session_id: "sess_4f22", kind: "web_fetch",  hash: "01…442", signed: true,  signed_by: "claude-code/0.42", at: "09:41:22Z" },
      { id: "evt_99197", session_id: "sess_8c1a", kind: "bash",       hash: "ee…2c1", signed: true,  signed_by: "claude-code/0.42", at: "09:42:08Z" },
    ],
  },

  reports: {
    kpi: { scheduled: 5, delivered_30d: 18, ad_hoc: 12, bundles: 3 },
    scheduled: [
      { id: "rep_w_trust",   name: "Weekly trust + safety",       cadence: "Mondays 09:00", next_run: "Mon May 11 09:00", recipients: ["mara@ops", "devon@ops", "#sec-ops"], format: "PDF",   last_run: "May 4" },
      { id: "rep_w_cost",    name: "Weekly cost + budgets",        cadence: "Mondays 09:00", next_run: "Mon May 11 09:00", recipients: ["mara@ops", "fin-ops@anthropic"],     format: "PDF",   last_run: "May 4" },
      { id: "rep_d_evals",   name: "Daily evals digest",            cadence: "Daily 18:00",   next_run: "Today 18:00",      recipients: ["#evals"],                              format: "CSV",   last_run: "Yesterday" },
      { id: "rep_m_compl",   name: "Monthly compliance summary",   cadence: "1st 06:00",     next_run: "Jun 1 06:00",      recipients: ["legal@anthropic"],                     format: "PDF",   last_run: "May 1" },
      { id: "rep_w_audit",   name: "Weekly audit export",           cadence: "Sundays 23:55", next_run: "Sun May 17 23:55", recipients: ["audit-archive@anthropic"],            format: "JSONL", last_run: "May 4" },
    ],
    ad_hoc: [
      { id: "adh_201", name: "Cost spike May 6 — incident-attached",         by: "devon@ops", when: "2 days ago", size: "1.4 MB" },
      { id: "adh_200", name: "Auth latency post-mortem evidence bundle",     by: "mara@ops",  when: "5 days ago", size: "3.8 MB" },
      { id: "adh_199", name: "Q1 trust+safety review (signed)",                by: "mara@ops",  when: "21 days ago", size: "12.1 MB" },
    ],
    bundles: [
      { id: "soc2",        name: "SOC 2 evidence bundle",   framework: "SOC 2 Type II", status: "ready",   last_built: "12 min ago", range: "Apr 11 — May 10", content_hash: "soc2:b8c41e7a91" },
      { id: "iso27001",    name: "ISO 27001 evidence",       framework: "ISO/IEC 27001", status: "ready",   last_built: "4 h ago",    range: "Apr 11 — May 10", content_hash: "iso:f2180b33c1" },
      { id: "eu-ai-act",   name: "EU AI Act technical file", framework: "EU AI Act",     status: "stale",   last_built: "8 d ago",    range: "Apr 1 — May 1",   content_hash: "euai:a4e9715c08" },
    ],
  },

  settings: {
    general: {
      workspace_name: "Anthropic Ops",
      org_id: "org_8c1a4f22a771",
      created_at: "2024-09-12",
      tier: "Enterprise",
    },
    connections: [
      { id: "anthropic", name: "Anthropic API",   category: "Model providers",  status: "connected",       detail: "sk-ant-…6c4f · 3 keys",     fields: [
        { k: "base_url", label: "Base URL", type: "url",    value: "https://api.anthropic.com/v1" },
        { k: "api_key",  label: "API key",  type: "secret", value: "sk-ant-api03-************************6c4f" },
      ], last_sync: "12s ago", health: "ok" },
      { id: "openai",    name: "OpenAI API",      category: "Model providers",  status: "connected",       detail: "sk-…2e0a · 1 key",         fields: [
        { k: "api_key", label: "API key", type: "secret", value: "sk-proj-************************2e0a" },
      ], last_sync: "2 min ago", health: "ok" },
      { id: "github",    name: "GitHub",           category: "Repos",            status: "connected",       detail: "github.com/anthropic-ops · 24 repos", fields: [
        { k: "host",  label: "Host",          type: "url",    value: "https://github.com" },
        { k: "token", label: "Personal token", type: "secret", value: "ghp_*****************************4Zk" },
      ], last_sync: "44s ago", health: "ok" },
      { id: "slack",     name: "Slack",            category: "Notifications",    status: "connected",       detail: "T0…98 · #sec-ops · #ops",   fields: [
        { k: "bot_token", label: "Bot token", type: "secret", value: "xoxb-************************************Z2" },
      ], last_sync: "1 min ago", health: "ok" },
      { id: "pagerduty", name: "PagerDuty",        category: "Notifications",    status: "needs-attention", detail: "key rotates in 4 days",      fields: [
        { k: "service_key", label: "Service key", type: "secret", value: "pd-************************************84" },
      ], last_sync: "4 h ago", health: "warn" },
      { id: "vault",     name: "HashiCorp Vault",  category: "Secrets",          status: "connected",       detail: "vault.internal · token TTL 24h", fields: [
        { k: "addr",  label: "Address",  type: "url",    value: "https://vault.internal" },
        { k: "token", label: "Token",    type: "secret", value: "hvs.************************************AB" },
      ], last_sync: "8 min ago", health: "ok" },
      { id: "datadog",   name: "Datadog",          category: "Observability",    status: "connected",       detail: "us3.datadoghq.com · 18 monitors", fields: [
        { k: "api_key", label: "API key", type: "secret", value: "dd-************************************7c" },
      ], last_sync: "21s ago", health: "ok" },
      { id: "opensearch", name: "OpenSearch",      category: "Data",             status: "connected",       detail: "events-* + receipts-*",      fields: [
        { k: "host", label: "Host", type: "url", value: "https://oss.internal:9200" },
      ], last_sync: "live",     health: "ok" },
      { id: "stripe",    name: "Stripe",            category: "Billing",          status: "connected",       detail: "acct_1Q…4j · live",          fields: [
        { k: "api_key", label: "API key", type: "secret", value: "rk_live_************************************84" },
      ], last_sync: "1 h ago",  health: "ok" },
      { id: "n8n",       name: "n8n automations",  category: "Automations",      status: "disconnected",    detail: "set base URL + API key to connect", fields: [
        { k: "base_url",       label: "Base URL",       type: "url",    value: "" },
        { k: "api_key",        label: "API key",        type: "secret", value: "env:N8N_API_KEY" },
        { k: "webhook_secret", label: "Webhook secret", type: "secret", value: "env:N8N_WEBHOOK_SECRET" },
      ], last_sync: "—", health: "warn" },
      { id: "proxmox",   name: "Proxmox VE",       category: "Infrastructure",   status: "disconnected",    detail: "set host + token to connect",  fields: [
        { k: "host",     label: "Host",      type: "url",    value: "" },
        { k: "token_id", label: "Token ID",  type: "string", value: "" },
        { k: "token",    label: "Token",     type: "secret", value: "env:PROXMOX_TOKEN" },
      ], last_sync: "—", health: "warn" },
    ],
    members: [
      { id: "u_mara",  name: "Mara Olin",   email: "mara@ops",   role: "Owner",   mfa: true,  last_seen: "now"        },
      { id: "u_devon", name: "Devon Park",  email: "devon@ops",  role: "Admin",   mfa: true,  last_seen: "12s ago"    },
      { id: "u_iris",  name: "Iris Cao",    email: "iris@ops",   role: "SRE",     mfa: true,  last_seen: "4 min ago"  },
      { id: "u_kai",   name: "Kai Park",    email: "kai@ops",    role: "SRE",     mfa: true,  last_seen: "1 h ago"    },
      { id: "u_lin",   name: "Lin Patel",   email: "lin@ops",    role: "Analyst", mfa: false, last_seen: "Yesterday"  },
    ],
    tokens: [
      { id: "tok_ci",     name: "ci-deploy",       scope: "approvals.write, sessions.read",  created_at: "Mar 02", last_used: "14s ago", expires_at: "Aug 02" },
      { id: "tok_archive",name: "audit-archive",   scope: "audit.read",                       created_at: "Apr 18", last_used: "8 h ago",  expires_at: "Oct 18" },
      { id: "tok_eval",   name: "eval-bot",        scope: "evals.run, sessions.read",         created_at: "Jan 11", last_used: "31 min ago", expires_at: "Jul 11" },
    ],
    webhooks: [
      { id: "wh_slack",  url: "https://hooks.slack.com/…/B07K…",        events: ["session.failed", "approval.denied"],          status: "ok",   delivery_stats: "18,321 · 99.97%" },
      { id: "wh_pd",     url: "https://events.pagerduty.com/v2/enqueue", events: ["incident.opened"],                             status: "ok",   delivery_stats: "412 · 100.0%" },
      { id: "wh_audit",  url: "https://audit-archive.internal/ingest",   events: ["audit.row"],                                    status: "warn", delivery_stats: "1.4M · 99.71%" },
    ],
    prefs: {
      retention: "90 days",
      timezone: "UTC",
      density: "compact",
      auto_refresh: true,
      ambient_audio: false,
      theme: "system",
      language: "en-US",
      experimental: false,
    },
    about: {
      version: "1.0.0",
      build_id: "ops-1.0.0+phase4",
      commit: "phase-4/security-workspace",
      built_at: new Date().toISOString(),
    },
  },

  /** Synthesized at module init below — placeholder so the type checks. */
  auditEvents: [],
  /** Re-auth tracker — keyed by user email. Mock-only. */
  reauth: {},
  /** Workspace runtime state — Phase 5. */
  runtime: {
    paused: false,
    paused_at: undefined,
    paused_by: undefined,
  },
};

// Build the 1200-row hash chain after the seed is constructed (sync init).
seed.auditEvents = buildSeedAuditChain(1200);

/** Deterministic-ish minute series, clamped to [0,1]. */
function minuteSeries(n: number, base: number, jitter: number, peak?: number): number[] {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    const wave = Math.sin((i / n) * Math.PI * 2) * jitter * 0.5;
    const noise = (Math.sin(i * 7.13) + Math.sin(i * 3.7)) * jitter * 0.25;
    v = Math.max(0, Math.min(1, base + wave + noise));
    if (peak && i === Math.floor(n * 0.85)) v = peak;
    out.push(Number(v.toFixed(3)));
  }
  return out;
}

/** 0..N day uptime ratio strip with `incidentDays` random down-days under base. */
function uptimeStrip(n: number, base: number, incidentDays = 1): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(base + (Math.sin(i * 1.7) + Math.sin(i * 0.3)) * 0.0006);
  }
  for (let k = 0; k < incidentDays; k++) {
    const idx = (n - 1 - k * 7) % n;
    if (idx >= 0 && idx < n) out[idx] = Math.max(0.5, base - 0.04 - k * 0.01);
  }
  return out.map((v) => Number(Math.max(0, Math.min(1, v)).toFixed(4)));
}

/** Heat row: 24 buckets, mostly zeros with `n` random non-zero spikes peaking at `peak`. */
function heatRow(n: number, peak: number, _seed: number): number[] {
  const out = new Array<number>(n).fill(0);
  // Deterministic placement based on _seed
  const positions = [3, 8, 15, 19, 22];
  let placed = 0;
  for (let i = 0; placed < peak && i < positions.length; i++) {
    const p = (positions[i]! + _seed) % n;
    out[p] = 0.4 + (placed % 2) * 0.4;
    placed += 1;
  }
  return out;
}

/**
 * Builds a deterministic, hash-chained sequence of N audit events. Sync-only —
 * uses node:crypto SHA-256, but produces output bit-identical to what
 * `computeAuditHash` (which uses Web Crypto) yields, since both hash the same
 * canonicalJson(body) bytes.
 */
function buildSeedAuditChain(n: number): import("@ops/shared").AuditRow[] {
  const out: import("@ops/shared").AuditRow[] = [];
  const actors = ["mara@ops", "devon@ops", "iris@ops", "kai@ops", "claude-code", "release-bot"];
  const roles = ["admin", "sre", "agent"];
  const actions = [
    "approval.decide", "agent.rollback", "evals.run", "session.start", "session.end",
    "policy.update", "token.rotate", "member.invite", "deploy.execute", "incident.ack",
  ];
  const targets = [
    "approval/apr_8821", "deploy/dep_4421", "agent/claude-code", "session/sess_8c1a",
    "policy/p_destr", "token/tok_ci", "member/u_lin", "incident/inc_71",
  ];
  const baseTs = Date.now() - 25 * 60 * 60 * 1000;

  let prevHash = "";
  for (let i = 0; i < n; i++) {
    const tsMs = baseTs + Math.floor((i / n) * 25 * 60 * 60 * 1000);
    const body = {
      id: `evt_${(100000 + i).toString(36)}`,
      ts: new Date(tsMs).toISOString(),
      actor: actors[i % actors.length]!,
      role: roles[i % roles.length]!,
      action: actions[i % actions.length]!,
      target: targets[i % targets.length]!,
      ip: `10.0.${(i / 256) | 0}.${i % 256}`,
      ua: i % 2 === 0 ? "ops-web/1.0 (chrome)" : "ops-cli/0.42",
    };
    const canonical = canonicalJsonSync(body);
    const hash = createHash("sha256").update(prevHash + canonical).digest("hex");
    out.push({
      ...body,
      prev_hash: prevHash,
      hash,
      ...(i % 60 === 0 ? { anchored_at: new Date(tsMs).toISOString() } : {}),
    });
    prevHash = hash;
  }
  return out;
}

/** Sync mirror of packages/shared canonicalJson — kept here to avoid circular import + async init. */
function canonicalJsonSync(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonSync).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonSync(obj[k])}`).join(",")}}`;
  }
  throw new Error(`canonicalJsonSync: unsupported type ${typeof value}`);
}

