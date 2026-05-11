/**
 * Secret resolution for connection fields.
 *
 * Connection field values can be one of:
 *   - literal     "sk-ant-…6c4f"
 *   - env:NAME    reads process.env.NAME at request time
 *   - vault://…   reserved for the Vault connector (Wave 2)
 *
 * Storing the real secret in the DB is avoided where possible — operators
 * configure the env var on the server and reference it from the connection.
 * Pure function so it can be unit-tested.
 */

export type ResolvedSecret =
  | { ok: true; value: string }
  | { ok: false; reason: "missing_env" | "unsupported_scheme" | "vault_unavailable"; detail: string };

export function resolveSecret(input: string | undefined | null): ResolvedSecret {
  if (input === undefined || input === null || input === "") {
    return { ok: false, reason: "missing_env", detail: "(empty)" };
  }

  if (input.startsWith("env:")) {
    const name = input.slice("env:".length);
    const v = process.env[name];
    if (v === undefined || v === "") {
      return { ok: false, reason: "missing_env", detail: name };
    }
    return { ok: true, value: v };
  }

  if (input.startsWith("vault://")) {
    return {
      ok: false,
      reason: "vault_unavailable",
      detail: "Vault connector not yet implemented (P8 wave 2)",
    };
  }

  return { ok: true, value: input };
}
