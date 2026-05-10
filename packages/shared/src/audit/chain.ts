import { canonicalJson } from "./canonical";

/**
 * Hash-chained audit-event helpers.
 *
 * Producer side (apps/web mock store) appends events using `appendAudit`.
 * Verifier side (apps/web client) walks the chain via `verifyChain`. Both ends
 * agree because they share `canonicalJson` + the same hashing primitive (Web
 * Crypto's SHA-256).
 *
 * The genesis event's `prev_hash` is the empty string by convention; this is
 * what HANDOFF §5 calls "anchored hourly" — the *anchor* is then a signed
 * commitment to the latest row's hash, recorded out-of-band. Phase 4 ships the
 * chain itself; the offline anchor key + signing is Phase 6 work.
 */

/** Body fields covered by the hash — see HANDOFF §5. */
export type AuditRowBody = {
  id: string;
  ts: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  ip: string;
  ua: string;
};

export type AuditRow = AuditRowBody & {
  hash: string;
  prev_hash: string;
  anchored_at?: string;
};

export const GENESIS_PREV_HASH = "";

async function sha256Hex(input: string): Promise<string> {
  // Web Crypto: available in all modern browsers and in Node ≥20 as
  // `globalThis.crypto.subtle`. Producer-side seeding uses node:crypto sync
  // helpers directly to avoid awaiting at module init.
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto SubtleCrypto is not available");
  const buf = new TextEncoder().encode(input);
  const digest = await subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Compute the canonical hash for a row body given its predecessor's hash. */
export async function computeAuditHash(prevHash: string, body: AuditRowBody): Promise<string> {
  return sha256Hex(prevHash + canonicalJson(body));
}

/** Append-style helper: returns the full row including hash + prev_hash. */
export async function buildAuditRow(prevHash: string, body: AuditRowBody): Promise<AuditRow> {
  const hash = await computeAuditHash(prevHash, body);
  return { ...body, prev_hash: prevHash, hash };
}

export type ChainVerification = {
  ok: boolean;
  rowsChecked: number;
  /** Index of the first invalid row, if any. */
  firstBad?: number;
  /** "hash_mismatch" | "prev_hash_mismatch" | "computed_mismatch" */
  reason?: string;
};

/**
 * Walks the chain in order. Pure and chunk-friendly: callers can split the
 * input list across animation frames if they care about rendering during the
 * verify pass. For 1000 rows on a modern laptop this is well under 300ms;
 * tests assert the budget.
 */
export async function verifyChain(rows: readonly AuditRow[]): Promise<ChainVerification> {
  let prev = GENESIS_PREV_HASH;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.prev_hash !== prev) {
      return { ok: false, rowsChecked: i, firstBad: i, reason: "prev_hash_mismatch" };
    }
    const body: AuditRowBody = {
      id: row.id,
      ts: row.ts,
      actor: row.actor,
      role: row.role,
      action: row.action,
      target: row.target,
      ip: row.ip,
      ua: row.ua,
    };
    const computed = await computeAuditHash(prev, body);
    if (computed !== row.hash) {
      return { ok: false, rowsChecked: i, firstBad: i, reason: "computed_mismatch" };
    }
    prev = row.hash;
  }
  return { ok: true, rowsChecked: rows.length };
}
