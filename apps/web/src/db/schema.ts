/**
 * Drizzle schema for Ops Command Center.
 *
 * Mirrors HANDOFF §5 entities + Phase 4 / 5 additions (audit chain, runtime
 * state, reauth markers, settings tables). Field names use snake_case to match
 * the HANDOFF spec verbatim — Drizzle's type inference flows through to the
 * tRPC layer.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  bigint,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// =============================================================================
// Enums
// =============================================================================

export const statusToneEnum = pgEnum("status_tone", ["ok", "warn", "bad", "info", "violet"]);
export const sessionStatusEnum = pgEnum("session_status", ["ok", "warn", "bad", "idle"]);
export const sessionOutcomeEnum = pgEnum("session_outcome", ["in-progress", "success", "aborted", "failed"]);
export const severityEnum = pgEnum("severity", ["low", "med", "high"]);
export const approvalDecisionEnum = pgEnum("approval_decision", ["approve", "deny", "edit", "expire"]);
export const policyModeEnum = pgEnum("policy_mode", ["always-ask", "ask-once", "auto-approve", "ask-if-unsigned"]);
export const deployChannelEnum = pgEnum("deploy_channel", ["stable", "canary", "shadow"]);
export const investigationStatusEnum = pgEnum("investigation_status", ["open", "triage", "closed"]);
export const evidenceStatusEnum = pgEnum("evidence_status", ["pending", "verified", "tampered"]);
export const roleEnum = pgEnum("role", ["admin", "sre", "analyst", "viewer", "agent"]);
export const notificationLevelEnum = pgEnum("notification_level", ["info", "warn", "bad"]);
export const incidentStatusEnum = pgEnum("incident_status", ["investigating", "monitoring", "resolved"]);
export const agentStatusEnum = pgEnum("agent_status", ["active", "paused", "drained"]);
export const deployStatusEnum = pgEnum("deploy_status", ["rolled-out", "rolling", "rolled-back"]);
export const evalStatusEnum = pgEnum("eval_status", ["ok", "warn", "bad"]);
export const evalRunStatusEnum = pgEnum("eval_run_status", [
  "queued",
  "running",
  "passed",
  "failed",
  "error",
]);
export const reportFormatEnum = pgEnum("report_format", ["PDF", "CSV", "JSONL"]);
export const bundleStatusEnum = pgEnum("bundle_status", ["ready", "stale", "building"]);
export const memberRoleEnum = pgEnum("member_role", ["Owner", "Admin", "SRE", "Analyst", "Viewer"]);

// =============================================================================
// Sessions / tool calls / approvals — the operational core
// =============================================================================

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    agent_version: text("agent_version").notNull(),
    model: text("model").notNull(),
    repo: text("repo").notNull(),
    branch: text("branch"),
    goal: text("goal").notNull(),
    operator: text("operator").notNull(),
    started_at: timestamp("started_at", { withTimezone: true }).notNull(),
    runtime_s: integer("runtime_s").notNull().default(0),
    cost_usd: doublePrecision("cost_usd").notNull().default(0),
    tokens_in: integer("tokens_in").notNull().default(0),
    tokens_out: integer("tokens_out").notNull().default(0),
    tool_calls: integer("tool_calls").notNull().default(0),
    trust_score: doublePrecision("trust_score").notNull().default(1),
    status: sessionStatusEnum("status").notNull(),
    outcome: sessionOutcomeEnum("outcome").notNull(),
    current_step_id: text("current_step_id"),
    /** Phase 1 carries the full ActiveSession shape (sparkline, hot, pinned, step text). */
    extra: jsonb("extra").$type<Record<string, unknown>>().notNull().default({}),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    by_started: index("sessions_started_at_idx").on(t.started_at),
    by_status: index("sessions_status_idx").on(t.status),
  }),
);

export const tool_calls = pgTable(
  "tool_calls",
  {
    id: text("id").primaryKey(),
    session_id: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    t_offset_ms: integer("t_offset_ms").notNull(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    cost_usd: doublePrecision("cost_usd").notNull().default(0),
    latency_ms: integer("latency_ms").notNull().default(0),
    note: text("note"),
    signed: boolean("signed").notNull().default(false),
    sig_key_id: text("sig_key_id"),
    hash: text("hash").notNull(),
  },
  (t) => ({
    by_session: index("tool_calls_session_idx").on(t.session_id, t.t_offset_ms),
  }),
);

export const approvals = pgTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    session_id: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    severity: severityEnum("severity").notNull(),
    policy_id: text("policy_id").notNull(),
    command: text("command").notNull(),
    justification: text("justification").notNull(),
    blast_radius: text("blast_radius").notNull(),
    requested_at: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    auto_deny_at: timestamp("auto_deny_at", { withTimezone: true }).notNull(),
    decided_at: timestamp("decided_at", { withTimezone: true }),
    decision: approvalDecisionEnum("decision"),
    approver_user_id: text("approver_user_id"),
    edited_command: text("edited_command"),
    /** Phase 2 fields the surface needs but HANDOFF §5 doesn't explicitly call out (agent, action, etc.) live here. */
    extra: jsonb("extra").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => ({
    by_session: index("approvals_session_idx").on(t.session_id),
    pending_only: index("approvals_pending_idx").on(t.decided_at).where(sql`${t.decided_at} IS NULL`),
  }),
);

export const policies = pgTable("policies", {
  id: text("id").primaryKey(),
  surface: text("surface").notNull(),
  mode: policyModeEnum("mode").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  owner_user_id: text("owner_user_id").notNull(),
  /** Display name; HANDOFF §5 has it on the row, the mock has it under .name. */
  name: text("name").notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// =============================================================================
// Infra
// =============================================================================

export const services = pgTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  stack: text("stack").notNull(),
  region: text("region").notNull(),
  replicas: text("replicas").notNull(),
  cpu_pct: doublePrecision("cpu_pct").notNull().default(0),
  mem_pct: doublePrecision("mem_pct").notNull().default(0),
  rps: doublePrecision("rps").notNull().default(0),
  error_pct: doublePrecision("error_pct").notNull().default(0),
  p95_ms: integer("p95_ms").notNull().default(0),
  status: statusToneEnum("status").notNull(),
  reason: text("reason"),
  version: text("version").notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const incidents = pgTable("incidents", {
  id: text("id").primaryKey(),
  severity: severityEnum("severity").notNull(),
  service_id: text("service_id").references(() => services.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  started_at: timestamp("started_at", { withTimezone: true }).notNull(),
  ack_at: timestamp("ack_at", { withTimezone: true }),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
  acked_by: text("acked_by"),
  postmortem_url: text("postmortem_url"),
  status: incidentStatusEnum("status").notNull(),
  assignee: text("assignee").notNull(),
});

export const slos = pgTable("slos", {
  id: text("id").primaryKey(),
  service_id: text("service_id").references(() => services.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  target: text("target").notNull(),
  actual: text("actual").notNull(),
  burn_rate: text("burn_rate").notNull(),
  state: statusToneEnum("state").notNull(),
});

export const deployTargetKindEnum = pgEnum("deploy_target_kind", ["service", "agent"]);

export const deploys = pgTable("deploys", {
  id: text("id").primaryKey(),
  target_kind: deployTargetKindEnum("target_kind").notNull(),
  service_or_agent_id: text("service_or_agent_id").notNull(),
  version: text("version").notNull(),
  /** Previous version — agent deploys carry this; service deploys often don't. */
  from_version: text("from_version"),
  channel: deployChannelEnum("channel").notNull(),
  who: text("who").notNull(),
  when: timestamp("when", { withTimezone: true }).notNull().defaultNow(),
  eval_delta: text("eval_delta").notNull().default("0.0%"),
  cost_delta: text("cost_delta").notNull().default("0.0%"),
  rollback_candidate: boolean("rollback_candidate").notNull().default(false),
  status: deployStatusEnum("status").notNull().default("rolled-out"),
});

/** Region cards on the Infra dashboard. Not a HANDOFF §5 entity but operationally first-class. */
export const regions = pgTable("regions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: statusToneEnum("status").notNull(),
  nodes: text("nodes").notNull(),
  az: integer("az").notNull(),
  cost_per_hour: text("cost_per_hour").notNull(),
  traffic_pct: doublePrecision("traffic_pct").notNull(),
});

/** 60-minute CPU load per service for the heat-bar grid. Sparse; rebuilt by ingestion. */
export const service_load = pgTable(
  "service_load",
  {
    service_id: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    minute: integer("minute").notNull(),
    cpu_pct: doublePrecision("cpu_pct").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.service_id, t.minute] }),
  }),
);

// =============================================================================
// Status page (separate from internal incidents)
// =============================================================================

export const status_signals = pgTable("status_signals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  state: statusToneEnum("state").notNull(),
  uptime: text("uptime"),
  last_incident: text("last_incident"),
  /** Public vs internal — the public-mode preview filters on this. */
  is_public: boolean("is_public").notNull(),
  /** 90-day uptime ratios as a JSONB number array. */
  uptime90: jsonb("uptime90").$type<number[]>().notNull().default([]),
  note: text("note"),
});

export const status_incidents = pgTable("status_incidents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  state: incidentStatusEnum("state").notNull(),
  started_at: text("started_at").notNull(),
  updates: integer("updates").notNull().default(0),
  is_public: boolean("is_public").notNull(),
});

export const status_page_meta = pgTable("status_page_meta", {
  /** Singleton row keyed on a constant. */
  id: text("id").primaryKey().default("default"),
  url: text("url").notNull(),
  published: boolean("published").notNull().default(false),
});

// =============================================================================
// Agents
// =============================================================================

export const agent_versions = pgTable("agent_versions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  channel: deployChannelEnum("channel").notNull(),
  status: agentStatusEnum("status").notNull(),
  model: text("model").notNull(),
  owner: text("owner").notNull(),
  trust_score: doublePrecision("trust_score").notNull(),
  runs_24h: integer("runs_24h").notNull().default(0),
  cost_24h: doublePrecision("cost_24h").notNull().default(0),
  p95_s: doublePrecision("p95_s").notNull().default(0),
  tools: jsonb("tools").$type<string[]>().notNull().default([]),
  rate_per_min: integer("rate_per_min").notNull().default(0),
  budget: doublePrecision("budget").notNull().default(0),
  signing_key_fp: text("signing_key_fp").notNull(),
  signed: boolean("signed").notNull().default(false),
  drift: doublePrecision("drift").notNull().default(0),
  spark: jsonb("spark").$type<number[]>().notNull().default([]),
});

export const signing_keys = pgTable("signing_keys", {
  fingerprint: text("fingerprint").primaryKey(),
  agent: text("agent").notNull(),
  algo: text("algo").notNull(),
  sigs_24h: integer("sigs_24h").notNull().default(0),
  last_used: timestamp("last_used", { withTimezone: true }),
});

// =============================================================================
// Evals
// =============================================================================

export const eval_suites = pgTable("eval_suites", {
  id: text("id").primaryKey(),
  cases: integer("cases").notNull(),
  pass_rate: doublePrecision("pass_rate").notNull(),
  baseline_pass_rate: doublePrecision("baseline_pass_rate").notNull(),
  delta: doublePrecision("delta").notNull().default(0),
  flake_rate: doublePrecision("flake_rate").notNull().default(0),
  model: text("model").notNull(),
  status: evalStatusEnum("status").notNull(),
  trend: jsonb("trend").$type<number[]>().notNull().default([]),
  last_ran_at: timestamp("last_ran_at", { withTimezone: true }),
});

/**
 * One row per eval-suite run. The realtime worker (apps/realtime/eval-tick.ts)
 * claims queued rows, simulates the run, and updates pass_rate + cases_run
 * on completion. The suite's cached pass_rate / last_ran_at get bumped from
 * the latest completed run.
 */
export const eval_runs = pgTable(
  "eval_runs",
  {
    id: text("id").primaryKey(),
    suite_id: text("suite_id")
      .notNull()
      .references(() => eval_suites.id, { onDelete: "cascade" }),
    status: evalRunStatusEnum("status").notNull().default("queued"),
    started_by: text("started_by").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    started_at: timestamp("started_at", { withTimezone: true }),
    finished_at: timestamp("finished_at", { withTimezone: true }),
    pass_rate: doublePrecision("pass_rate"),
    cases_run: integer("cases_run"),
    error: text("error"),
  },
  (t) => ({
    by_suite_recent: index("eval_runs_suite_id_created_at_idx").on(t.suite_id, t.created_at),
    pending: index("eval_runs_pending_idx").on(t.created_at),
  }),
);

/**
 * Individual cases within an eval suite. The worker iterates over the
 * enabled rows when running a suite, calls the model with `prompt`, and
 * scores the response against `expected_pattern` (regex). Results land
 * in eval_case_results so the operator can drill into pass/fail per case.
 */
export const eval_cases = pgTable(
  "eval_cases",
  {
    id: text("id").primaryKey(),
    suite_id: text("suite_id")
      .notNull()
      .references(() => eval_suites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prompt: text("prompt").notNull(),
    /** JS-flavored regex matched against the model's response text. */
    expected_pattern: text("expected_pattern").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    by_suite: index("eval_cases_suite_idx").on(t.suite_id),
  }),
);

/**
 * One row per case execution within a run. `output` is capped to a
 * reasonable display length — full transcripts would balloon the table.
 */
export const eval_case_results = pgTable(
  "eval_case_results",
  {
    id: text("id").primaryKey(),
    run_id: text("run_id")
      .notNull()
      .references(() => eval_runs.id, { onDelete: "cascade" }),
    case_id: text("case_id")
      .notNull()
      .references(() => eval_cases.id, { onDelete: "cascade" }),
    passed: boolean("passed").notNull(),
    output: text("output").notNull().default(""),
    latency_ms: integer("latency_ms").notNull().default(0),
    cost_usd: doublePrecision("cost_usd").notNull().default(0),
    error: text("error"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    by_run: index("eval_case_results_run_idx").on(t.run_id),
  }),
);

export const eval_regressions = pgTable("eval_regressions", {
  id: text("id").primaryKey(),
  suite_id: text("suite_id").notNull().references(() => eval_suites.id, { onDelete: "cascade" }),
  case: text("case").notNull(),
  model: text("model").notNull(),
  first_fail: timestamp("first_fail", { withTimezone: true }).notNull(),
  occurrences: integer("occurrences").notNull().default(1),
  owner: text("owner").notNull(),
  commit: text("commit").notNull(),
});

/** A/B card is currently a singleton on the Evals dashboard; one row keyed by id="default". */
export const eval_ab = pgTable("eval_ab", {
  id: text("id").primaryKey().default("default"),
  name: text("name").notNull(),
  a_label: text("a_label").notNull(),
  a_wins: integer("a_wins").notNull().default(0),
  a_score: doublePrecision("a_score").notNull().default(0),
  b_label: text("b_label").notNull(),
  b_wins: integer("b_wins").notNull().default(0),
  b_score: doublePrecision("b_score").notNull().default(0),
  trials: text("trials").notNull(),
  significance: text("significance").notNull(),
});

// =============================================================================
// Budgets
// =============================================================================

export const budgets = pgTable("budgets", {
  id: text("id").primaryKey(),
  team_id: text("team_id").notNull().unique(),
  label: text("label").notNull(),
  daily_cap: doublePrecision("daily_cap").notNull(),
  cap_mtd: doublePrecision("cap_mtd").notNull(),
  spend_24h: doublePrecision("spend_24h").notNull().default(0),
  mtd_actual: doublePrecision("mtd_actual").notNull().default(0),
  forecast_eom: doublePrecision("forecast_eom").notNull().default(0),
  agents: integer("agents").notNull().default(0),
  runs: integer("runs").notNull().default(0),
  trend: text("trend").notNull().default("0%"),
  spark: jsonb("spark").$type<number[]>().notNull().default([]),
  status: statusToneEnum("status").notNull(),
});

export const budget_breaches = pgTable("budget_breaches", {
  id: text("id").primaryKey(),
  team: text("team").notNull(),
  cap: text("cap").notNull(),
  amount: text("amount").notNull(),
  when: timestamp("when", { withTimezone: true }).notNull().defaultNow(),
  action: text("action").notNull(),
  resolved: boolean("resolved").notNull().default(false),
});

/** Workspace-level budget singleton + the MTD daily series. */
export const budget_meta = pgTable("budget_meta", {
  id: text("id").primaryKey().default("default"),
  spend_24h: doublePrecision("spend_24h").notNull().default(0),
  cap_day: doublePrecision("cap_day").notNull().default(0),
  spend_mtd: doublePrecision("spend_mtd").notNull().default(0),
  cap_month: doublePrecision("cap_month").notNull().default(0),
  forecast: doublePrecision("forecast").notNull().default(0),
  breaches_30d: integer("breaches_30d").notNull().default(0),
  mtd_daily: jsonb("mtd_daily").$type<number[]>().notNull().default([]),
  cap_line: doublePrecision("cap_line").notNull().default(0),
});

// =============================================================================
// Trust
// =============================================================================

export const investigations = pgTable("investigations", {
  id: text("id").primaryKey(),
  severity: severityEnum("severity").notNull(),
  title: text("title").notNull(),
  session_id: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
  opened_at: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  evidence_status: evidenceStatusEnum("evidence_status").notNull(),
  status: investigationStatusEnum("status").notNull(),
});

export const evidence_events = pgTable(
  "evidence_events",
  {
    id: text("id").primaryKey(),
    session_id: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    hash: text("hash").notNull(),
    signed: boolean("signed").notNull().default(false),
    signed_by: text("signed_by"),
    signed_at: timestamp("signed_at", { withTimezone: true }),
  },
  (t) => ({
    by_session: index("evidence_session_idx").on(t.session_id),
  }),
);

export const threat_buckets = pgTable(
  "threat_buckets",
  {
    category: text("category").notNull(),
    hour: integer("hour").notNull(),
    value: doublePrecision("value").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.category, t.hour] }),
  }),
);

// =============================================================================
// Audit chain
// =============================================================================

/**
 * Append-only hash-chained audit log. `seq` gives a strict total order; `hash`
 * is SHA-256(prev_hash || canonical_json(body)). Inserts must:
 *   1. Run inside a transaction
 *   2. SELECT the tail row FOR UPDATE
 *   3. Compute the new hash
 *   4. INSERT
 * The chain stays valid across crashes because the prev_hash references the
 * persisted tail, not in-memory state.
 */
export const audit_events = pgTable(
  "audit_events",
  {
    seq: bigint("seq", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    id: text("id").notNull().unique(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    actor: text("actor").notNull(),
    role: roleEnum("role").notNull(),
    action: text("action").notNull(),
    target: text("target").notNull(),
    ip: text("ip").notNull(),
    ua: text("ua").notNull(),
    hash: text("hash").notNull(),
    prev_hash: text("prev_hash").notNull(),
    anchored_at: timestamp("anchored_at", { withTimezone: true }),
  },
  (t) => ({
    by_actor: index("audit_actor_idx").on(t.actor),
    by_action: index("audit_action_idx").on(t.action),
    by_ts: index("audit_ts_idx").on(t.ts),
  }),
);

// =============================================================================
// Notifications
// =============================================================================

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    level: notificationLevelEnum("level").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    read: boolean("read").notNull().default(false),
    target_url: text("target_url"),
  },
  (t) => ({
    by_read: index("notif_read_idx").on(t.read, t.ts),
  }),
);

// =============================================================================
// Reports
// =============================================================================

export const scheduled_reports = pgTable("scheduled_reports", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cadence: text("cadence").notNull(),
  next_run: text("next_run").notNull(),
  recipients: jsonb("recipients").$type<string[]>().notNull().default([]),
  format: reportFormatEnum("format").notNull(),
  last_run: text("last_run"),
});

export const ad_hoc_reports = pgTable("ad_hoc_reports", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  by: text("by").notNull(),
  generated_at: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  size: text("size").notNull(),
  /** What this report is over — picks the data source on generate. */
  kind: text("kind").notNull().default("audit-events"),
  /** Serialization format. Drives Content-Type on download. */
  format: text("format").notNull().default("JSONL"),
  /** Generated content body. Empty until the row has been materialized. */
  content: text("content").notNull().default(""),
});

export const compliance_bundles = pgTable("compliance_bundles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  framework: text("framework").notNull(),
  status: bundleStatusEnum("status").notNull(),
  last_built: text("last_built").notNull(),
  range: text("range").notNull(),
  content_hash: text("content_hash").notNull(),
});

// =============================================================================
// Settings
// =============================================================================

export const workspace = pgTable("workspace", {
  id: text("id").primaryKey().default("default"),
  workspace_name: text("workspace_name").notNull(),
  org_id: text("org_id").notNull(),
  created_at: text("created_at").notNull(),
  tier: text("tier").notNull(),
  /** About-page build metadata kept here for simplicity. */
  version: text("version").notNull().default("0.0.0"),
  build_id: text("build_id").notNull().default("dev"),
  commit: text("commit").notNull().default("HEAD"),
  built_at: timestamp("built_at", { withTimezone: true }).notNull().defaultNow(),
});

export const connections = pgTable("connections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  /**
   * Display status — derived from real signals (last test result, field
   * completeness, connector availability). Allowed values:
   *   stub | incomplete | unverified | connected | needs-attention
   * The router computes the value on every save/test; the DB stores it so
   * the dashboard can render without recomputing.
   */
  status: text("status").notNull(),
  detail: text("detail").notNull(),
  /** Field config (JSONB so adding a field doesn't require a migration). */
  fields: jsonb("fields")
    .$type<Array<{ k: string; label: string; type: "url" | "secret" | "string" | "bool"; value: string }>>()
    .notNull()
    .default([]),
  last_sync: text("last_sync").notNull(),
  health: statusToneEnum("health").notNull(),
  /** When the connector last successfully tested. Null if never tested. */
  last_test_at: timestamp("last_test_at", { withTimezone: true }),
  /** Short detail line from the most recent test (success or failure). */
  last_test_detail: text("last_test_detail"),
  /** Whether the most recent test passed. Null if never tested. */
  last_test_ok: boolean("last_test_ok"),
});

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: memberRoleEnum("role").notNull(),
  mfa: boolean("mfa").notNull().default(false),
  last_seen: timestamp("last_seen", { withTimezone: true }),
});

export const tokens = pgTable(
  "tokens",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** Comma-separated scopes for the read-only UI list; authoritative source is `scopes`. */
    scope: text("scope").notNull(),
    /** Authoritative scope set used by the ingest auth check. */
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    /** SHA-256 of the raw secret. Raw secret is shown once on create and never stored. */
    secret_hash: text("secret_hash"),
    /** Short fingerprint shown in the UI: first 8 chars of the hash. */
    fingerprint: text("fingerprint"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    last_used: timestamp("last_used", { withTimezone: true }),
    expires_at: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    by_secret_hash: index("tokens_secret_hash_idx").on(t.secret_hash),
  }),
);

export const webhooks = pgTable("webhooks", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  events: jsonb("events").$type<string[]>().notNull().default([]),
  status: statusToneEnum("status").notNull(),
  /**
   * Cached human-readable delivery stats string used by older readers; the
   * router computes this fresh from webhook_deliveries on every overview()
   * call. Left here as a denormalized cache so direct DB queries see
   * something useful too.
   */
  delivery_stats: text("delivery_stats").notNull().default(""),
});

/**
 * One row per webhook delivery attempt — the worker in apps/realtime polls
 * for `status='pending'` rows whose next_retry_at has elapsed, POSTs the
 * payload to the webhook URL with an HMAC-SHA256 signature, and updates
 * status accordingly.
 *
 * State machine:
 *   pending    → in flight or queued for retry
 *   delivered  → received a 2xx
 *   dead       → exhausted retries (attempts >= 5)
 *
 * (No separate 'failed' state — failures stay 'pending' with next_retry_at
 *  set until they hit the dead threshold.)
 */
export const webhook_deliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    webhook_id: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event_id: text("event_id").notNull(),
    event_action: text("event_action").notNull(),
    /** Full audit row body (id, ts, actor, role, action, target, ip, ua, hash, prev_hash). */
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    http_status: integer("http_status"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    delivered_at: timestamp("delivered_at", { withTimezone: true }),
    next_retry_at: timestamp("next_retry_at", { withTimezone: true }),
  },
  (t) => ({
    by_webhook_recent: index("webhook_deliveries_webhook_id_created_at_idx").on(
      t.webhook_id,
      t.created_at,
    ),
    pending_ready: index("webhook_deliveries_pending_idx").on(t.next_retry_at),
  }),
);

export const prefs = pgTable("prefs", {
  /** Singleton row. Per-user prefs land in P7 once we have real auth + accounts beyond the dev bypass. */
  id: text("id").primaryKey().default("default"),
  retention: text("retention").notNull().default("90 days"),
  timezone: text("timezone").notNull().default("UTC"),
  density: text("density").notNull().default("compact"),
  auto_refresh: boolean("auto_refresh").notNull().default(true),
  ambient_audio: boolean("ambient_audio").notNull().default(false),
  theme: text("theme").notNull().default("system"),
  language: text("language").notNull().default("en-US"),
  experimental: boolean("experimental").notNull().default(false),
});

// =============================================================================
// Workspace runtime + reauth markers
// =============================================================================

export const runtime = pgTable("runtime", {
  id: text("id").primaryKey().default("default"),
  paused: boolean("paused").notNull().default(false),
  paused_at: timestamp("paused_at", { withTimezone: true }),
  paused_by: text("paused_by"),
});

export const reauth_markers = pgTable("reauth_markers", {
  email: varchar("email", { length: 320 }).primaryKey(),
  fresh_until: timestamp("fresh_until", { withTimezone: true }).notNull(),
});

/**
 * Generic KV singleton for per-surface meta blobs that aren't trivially
 * derivable from the row-store yet (e.g. live.kpi, trust.kpi, agents.kpi).
 * Phase 7 ingestion will keep these keys current as real data flows in.
 * Schema for each value lives in TypeScript, not the DB.
 */
export const kv_meta = pgTable("kv_meta", {
  key: text("key").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

