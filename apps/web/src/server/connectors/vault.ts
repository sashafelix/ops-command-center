import { resolveSecret } from "./secrets";
import { fieldValue, type Connector, type ConnectorTest } from "./types";
import type { Connection } from "@/server/mock/seed";

/**
 * HashiCorp Vault connector.
 *
 * Test calls /v1/auth/token/lookup-self which validates the current token
 * and returns its policies + TTL — a low-privilege, no-side-effects check
 * that proves both connectivity and credential health.
 */
export const vaultConnector: Connector = {
  id: "vault",
  name: "HashiCorp Vault",
  category: "Secrets",
  requiredFieldKeys: ["addr", "token"],
  implemented: true,
  defaultFields() {
    return [
      { k: "addr",  label: "Address", type: "url",    value: "https://vault.internal" },
      { k: "token", label: "Token",   type: "secret", value: "env:VAULT_TOKEN" },
    ];
  },
  async test(c: Connection): Promise<ConnectorTest> {
    const addrRaw = (fieldValue(c, "addr") ?? "").trim().replace(/\/+$/, "");
    if (!addrRaw) return { ok: false, reason: "addr is required" };
    if (!/^https?:\/\//i.test(addrRaw)) return { ok: false, reason: "addr must start with http(s)://" };

    const tokRef = fieldValue(c, "token");
    const tok = resolveSecret(tokRef);
    if (!tok.ok) return { ok: false, reason: `token: ${tok.reason} (${tok.detail})` };

    try {
      const res = await fetch(`${addrRaw}/v1/auth/token/lookup-self`, {
        method: "GET",
        headers: { "x-vault-token": tok.value },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status} from ${addrRaw}/v1/auth/token/lookup-self` };
      const body = (await res.json()) as {
        data?: { policies?: string[]; ttl?: number; renewable?: boolean };
      };
      const policies = body.data?.policies ?? [];
      const ttl = body.data?.ttl;
      const ttlStr = typeof ttl === "number" ? `ttl ${ttl}s` : "no ttl";
      return {
        ok: true,
        detail: `auth ok · policies [${policies.slice(0, 3).join(", ")}${policies.length > 3 ? ", …" : ""}] · ${ttlStr}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }
  },
};
