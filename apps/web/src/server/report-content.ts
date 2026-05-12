/**
 * Generate the body of an ad-hoc report.
 *
 * Pulls a window of recent rows from one of the known data sources
 * (audit events, sessions, approvals) and serializes them in the
 * requested format. Returns the body string + a content-type hint so
 * the download route can set headers correctly.
 *
 * Server-side only — uses the Drizzle client directly. Pure with
 * respect to time (callers can pass `since` if they want a fixed
 * window); defaults to "last 7 days".
 */

import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type ReportKind = "audit-events" | "sessions" | "approvals";
export type ReportFormat = "JSONL" | "JSON" | "CSV";

export type GeneratedReport = {
  body: string;
  contentType: string;
  fileExtension: string;
  rowCount: number;
};

const MAX_ROWS = 5_000;

export async function generateReport(
  kind: ReportKind,
  format: ReportFormat,
  sinceDays = 7,
): Promise<GeneratedReport> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const rows = await fetchRows(kind, since);
  const body = serialize(rows, format);
  return {
    body,
    contentType: contentTypeFor(format),
    fileExtension: format.toLowerCase(),
    rowCount: rows.length,
  };
}

async function fetchRows(kind: ReportKind, since: Date): Promise<Array<Record<string, unknown>>> {
  if (kind === "audit-events") {
    const rows = await db
      .select()
      .from(schema.audit_events)
      .where(gte(schema.audit_events.ts, since))
      .orderBy(desc(schema.audit_events.ts))
      .limit(MAX_ROWS);
    return rows.map((r) => ({
      id: r.id,
      ts: r.ts.toISOString(),
      actor: r.actor,
      role: r.role,
      action: r.action,
      target: r.target,
      ip: r.ip,
      ua: r.ua,
      hash: r.hash,
      prev_hash: r.prev_hash,
      anchored_at: r.anchored_at?.toISOString() ?? null,
    }));
  }
  if (kind === "sessions") {
    const rows = await db
      .select()
      .from(schema.sessions)
      .where(gte(schema.sessions.started_at, since))
      .orderBy(desc(schema.sessions.started_at))
      .limit(MAX_ROWS);
    return rows.map((r) => ({
      id: r.id,
      agent_version: r.agent_version,
      model: r.model,
      repo: r.repo,
      branch: r.branch,
      goal: r.goal,
      operator: r.operator,
      started_at: r.started_at.toISOString(),
      runtime_s: r.runtime_s,
      cost_usd: r.cost_usd,
      tokens_in: r.tokens_in,
      tokens_out: r.tokens_out,
      tool_calls: r.tool_calls,
      trust_score: r.trust_score,
      status: r.status,
      outcome: r.outcome,
    }));
  }
  // approvals
  const rows = await db
    .select()
    .from(schema.approvals)
    .where(gte(schema.approvals.requested_at, since))
    .orderBy(desc(schema.approvals.requested_at))
    .limit(MAX_ROWS);
  return rows.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    severity: r.severity,
    policy_id: r.policy_id,
    command: r.command,
    justification: r.justification,
    blast_radius: r.blast_radius,
    requested_at: r.requested_at.toISOString(),
    decided_at: r.decided_at?.toISOString() ?? null,
    decision: r.decision,
    approver_user_id: r.approver_user_id,
  }));
}

function serialize(rows: Array<Record<string, unknown>>, format: ReportFormat): string {
  if (format === "JSON") return JSON.stringify(rows, null, 2) + "\n";
  if (format === "JSONL") return rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  return toCsv(rows);
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "\n";
  const headers = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r))),
  );
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function contentTypeFor(format: ReportFormat): string {
  if (format === "JSON") return "application/json";
  if (format === "JSONL") return "application/x-ndjson";
  return "text/csv";
}

/** Human-readable byte size for the report row's `size` column. */
export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
