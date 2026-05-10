/**
 * Seed data lifted from Reference_Folder/Ops Dashboard.html STATE and extended
 * for HANDOFF §5 entities the mock omits (full Approval lifecycle, AuditEvent
 * chain, EvidenceEvent). Successive phases grow this; eventually it migrates
 * to a real backend.
 */

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
};
