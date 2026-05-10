import { createHash } from "node:crypto";
import type { AuditRow } from "@ops/shared";
import { mockStore } from "./mock/store";

/**
 * Sync canonical-json mirror — must match packages/shared/audit/canonical.
 * Kept local to keep this synchronous.
 */
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

/**
 * Append a new audit event chained to the latest tail. Returns the new row.
 * The chain stays valid: same `prev_hash || canonical_json(body)` discipline as
 * the seed and as the client-side verifier.
 */
export function appendAuditEvent(input: {
  actor: string;
  role: "admin" | "sre" | "analyst" | "viewer" | "agent";
  action: string;
  target: string;
  ip?: string;
  ua?: string;
}): AuditRow {
  const tail = mockStore.auditEvents[mockStore.auditEvents.length - 1];
  const prev_hash = tail?.hash ?? "";
  const id = `evt_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(36)}`;
  const body = {
    id,
    ts: new Date().toISOString(),
    actor: input.actor,
    role: input.role,
    action: input.action,
    target: input.target,
    ip: input.ip ?? "127.0.0.1",
    ua: input.ua ?? "ops-web/1.0",
  };
  const hash = createHash("sha256").update(prev_hash + canonicalJsonSync(body)).digest("hex");
  const row: AuditRow = { ...body, prev_hash, hash };
  mockStore.auditEvents.push(row);
  return row;
}
