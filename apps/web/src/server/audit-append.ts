import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { AuditRow } from "@ops/shared";
import { db, schema } from "@/db/client";

/**
 * Sync canonical-json mirror of packages/shared/audit/canonical. Kept local to
 * keep this synchronous (the verifier on the browser side uses Web Crypto's
 * async digest; producer-side seeds + appends use node:crypto sync).
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
 * Append a new audit event chained to the latest tail.
 *
 * Concurrency-safe: the SELECT … FOR UPDATE acquires a row lock on the tail
 * inside a serializable transaction, so two simultaneous appends serialize
 * around the chain instead of racing and forking it.
 *
 * Returns the new row's body in HANDOFF §5 shape.
 */
export async function appendAuditEvent(input: {
  actor: string;
  role: "admin" | "sre" | "analyst" | "viewer" | "agent";
  action: string;
  target: string;
  ip?: string;
  ua?: string;
}): Promise<AuditRow> {
  return db.transaction(async (tx) => {
    const [tail] = await tx.execute<{ hash: string }>(
      sql`SELECT hash FROM ${schema.audit_events} ORDER BY seq DESC LIMIT 1 FOR UPDATE`,
    );
    const prev_hash = tail?.hash ?? "";

    const ts = new Date();
    const id = `evt_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(36)}`;
    const body = {
      id,
      ts: ts.toISOString(),
      actor: input.actor,
      role: input.role,
      action: input.action,
      target: input.target,
      ip: input.ip ?? "127.0.0.1",
      ua: input.ua ?? "ops-web/1.0",
    };
    const hash = createHash("sha256").update(prev_hash + canonicalJsonSync(body)).digest("hex");

    await tx.insert(schema.audit_events).values({
      id,
      ts,
      actor: body.actor,
      role: body.role,
      action: body.action,
      target: body.target,
      ip: body.ip,
      ua: body.ua,
      hash,
      prev_hash,
    });

    return { ...body, prev_hash, hash } satisfies AuditRow;
  });
}
