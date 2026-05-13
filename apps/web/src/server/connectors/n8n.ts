import { resolveSecret } from "./secrets";
import { fieldValue, type Connector, type ConnectorTest } from "./types";
import type { Connection } from "@/server/mock/seed";

/**
 * n8n automations connector.
 *
 * Test calls the workflows endpoint with limit=1 — validates the API key
 * has read access and reports the total workflow count. webhook_secret
 * stays as a configurable field but isn't part of the test: it's used
 * for verifying signatures on inbound webhooks (n8n → ops-command-center),
 * which is a different direction of trust.
 */
export const n8nConnector: Connector = {
  id: "n8n",
  name: "n8n automations",
  category: "Automations",
  requiredFieldKeys: ["base_url", "api_key"],
  implemented: true,
  defaultFields() {
    return [
      { k: "base_url",       label: "Base URL",       type: "url",    value: "" },
      { k: "api_key",        label: "API key",        type: "secret", value: "env:N8N_API_KEY" },
      { k: "webhook_secret", label: "Webhook secret", type: "secret", value: "env:N8N_WEBHOOK_SECRET" },
    ];
  },
  async test(c: Connection): Promise<ConnectorTest> {
    const base = (fieldValue(c, "base_url") ?? "").trim().replace(/\/+$/, "");
    if (!base) return { ok: false, reason: "base_url is required" };
    if (!/^https?:\/\//i.test(base)) return { ok: false, reason: "base_url must start with http(s)://" };

    const keyRef = fieldValue(c, "api_key");
    const key = resolveSecret(keyRef);
    if (!key.ok) return { ok: false, reason: `api_key: ${key.reason} (${key.detail})` };

    try {
      const res = await fetch(`${base}/api/v1/workflows?limit=1`, {
        method: "GET",
        headers: {
          "x-n8n-api-key": key.value,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status} from ${base}/api/v1/workflows` };
      const body = (await res.json()) as { data?: unknown[]; nextCursor?: string };
      const visible = Array.isArray(body.data) ? body.data.length : 0;
      return {
        ok: true,
        detail: `auth ok · ${visible} workflow${visible === 1 ? "" : "s"} returned${body.nextCursor ? " (more available)" : ""}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }
  },
};
