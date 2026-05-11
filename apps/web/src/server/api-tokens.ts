/**
 * API token primitives for ingest auth.
 *
 * Raw token format: `ops_<env>_<32 random base32 chars>`. Example:
 *
 *   ops_live_5a8b3c1e9d2f4067a1b2c3d4e5f6a7b8
 *
 * The raw token is shown to the caller exactly once (on create). The DB
 * stores only the SHA-256 of the raw token. Verify hashes the incoming
 * Authorization header and looks up by secret_hash; the row carries the
 * scope set used to authorize the request.
 */

import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export type ApiTokenRow = {
  id: string;
  name: string;
  scopes: string[];
  fingerprint: string | null;
  expires_at: Date | null;
};

/** Reasonable scope set; ingest endpoints check membership. */
export const VALID_SCOPES = [
  "sessions.write",
  "sessions.read",
  "approvals.write",
  "approvals.read",
  "tool-calls.write",
  "audit.read",
] as const;
export type Scope = (typeof VALID_SCOPES)[number];

/** Generate a 32-char URL-safe random body over the base-36 alphabet. */
function randomBody(bytes = 32): string {
  const buf = randomBytes(bytes);
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    out += ALPHABET[buf[i]! % ALPHABET.length];
  }
  return out.slice(0, 32);
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** "ops_" + env + "_" + 32 random base32 chars. */
export function generateRawToken(env: "live" | "test" = "live"): string {
  return `ops_${env}_${randomBody()}`;
}

/** Pure scope check. Wildcard "*" matches any required scope. */
export function hasScope(granted: readonly string[], required: Scope): boolean {
  if (granted.includes("*")) return true;
  return granted.includes(required);
}

/**
 * Insert a new token. Returns the raw secret exactly once — caller must
 * persist it client-side. The DB only ever holds the SHA-256.
 */
export async function mintApiToken(input: {
  id: string;
  name: string;
  scopes: Scope[];
  expires_at?: Date | undefined;
}): Promise<{ row: ApiTokenRow; secret: string }> {
  const secret = generateRawToken("live");
  const secret_hash = hashToken(secret);
  const fingerprint = secret_hash.slice(0, 8);
  await db.insert(schema.tokens).values({
    id: input.id,
    name: input.name,
    scope: input.scopes.join(", "),
    scopes: input.scopes,
    secret_hash,
    fingerprint,
    expires_at: input.expires_at ?? null,
  });
  return {
    row: {
      id: input.id,
      name: input.name,
      scopes: input.scopes,
      fingerprint,
      expires_at: input.expires_at ?? null,
    },
    secret,
  };
}

/**
 * Look up a token by hashing the incoming raw secret. Updates `last_used`
 * on a hit. Throws `Unauthorized` on miss, expired, or revoked.
 */
export async function verifyApiToken(raw: string | null | undefined): Promise<ApiTokenRow> {
  if (!raw) throw new TokenError("missing_token");
  const secret_hash = hashToken(raw);
  const [row] = await db
    .select({
      id: schema.tokens.id,
      name: schema.tokens.name,
      scopes: schema.tokens.scopes,
      fingerprint: schema.tokens.fingerprint,
      expires_at: schema.tokens.expires_at,
    })
    .from(schema.tokens)
    .where(eq(schema.tokens.secret_hash, secret_hash));
  if (!row) throw new TokenError("invalid_token");
  if (row.expires_at && row.expires_at.getTime() < Date.now()) {
    throw new TokenError("expired_token");
  }
  await db
    .update(schema.tokens)
    .set({ last_used: sql`now()` })
    .where(eq(schema.tokens.id, row.id));
  return row;
}

export class TokenError extends Error {
  constructor(public reason: "missing_token" | "invalid_token" | "expired_token" | "insufficient_scope") {
    super(reason);
    this.name = "TokenError";
  }
}

/** Extract the Bearer token from a Request, or `null`. */
export function bearerFrom(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1]! : null;
}
