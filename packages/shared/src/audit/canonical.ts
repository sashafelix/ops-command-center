/**
 * Deterministic JSON serialization for audit-event hashing.
 *
 * Per HANDOFF §5: `hash = SHA-256(prev_hash || canonical_json(row))`. The exact
 * byte representation of the row is what gets hashed, so producer and verifier
 * must agree on canonicalization.
 *
 * Rules:
 *  - object keys sorted lexicographically
 *  - no whitespace
 *  - undefined values are omitted (parity with JSON.stringify default)
 *  - never operates on the row's own `hash` / `prev_hash` fields — those are
 *    inputs to the hash, not part of the canonicalized payload
 */

export function canonicalJson(value: unknown): string {
  return stringify(value);
}

function stringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonicalJson: non-finite number");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stringify).join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${stringify(obj[k])}`);
    return `{${parts.join(",")}}`;
  }
  // bigint / function / symbol etc. are not allowed in audit rows
  throw new Error(`canonicalJson: unsupported type ${typeof value}`);
}
