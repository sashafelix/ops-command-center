import { resolveSecret } from "./secrets";
import { fieldValue, type Connector, type ConnectorTest } from "./types";
import type { Connection } from "@/server/mock/seed";

/**
 * Datadog API connector.
 *
 * Test hits /api/v1/validate which is the canonical API-key liveness
 * check. The site field selects the right regional endpoint —
 * datadoghq.com (US1) / datadoghq.eu / us3.datadoghq.com / us5.datadoghq.com
 * / ap1.datadoghq.com / ddog-gov.com. Defaults to datadoghq.com.
 */
export const datadogConnector: Connector = {
  id: "datadog",
  name: "Datadog",
  category: "Observability",
  requiredFieldKeys: ["api_key"],
  implemented: true,
  defaultFields() {
    return [
      { k: "site",    label: "Site",    type: "string", value: "datadoghq.com" },
      { k: "api_key", label: "API key", type: "secret", value: "env:DATADOG_API_KEY" },
    ];
  },
  async test(c: Connection): Promise<ConnectorTest> {
    const site = ((fieldValue(c, "site") ?? "datadoghq.com").trim() || "datadoghq.com");
    const keyRef = fieldValue(c, "api_key");
    const key = resolveSecret(keyRef);
    if (!key.ok) return { ok: false, reason: `api_key: ${key.reason} (${key.detail})` };

    const url = `https://api.${site}/api/v1/validate`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "dd-api-key": key.value },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status} from ${url}` };
      const body = (await res.json()) as { valid?: boolean };
      if (body.valid !== true) return { ok: false, reason: "api_key not valid for this site" };
      return { ok: true, detail: `auth ok · ${site}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }
  },
};
