import { resolveSecret } from "./secrets";
import { fieldValue, type Connector, type ConnectorTest } from "./types";
import type { Connection } from "@/server/mock/seed";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export const openaiConnector: Connector = {
  id: "openai",
  name: "OpenAI API",
  category: "Model providers",
  requiredFieldKeys: ["api_key"],
  implemented: true,
  defaultFields() {
    return [
      { k: "base_url", label: "Base URL", type: "url", value: DEFAULT_BASE_URL },
      { k: "api_key", label: "API key", type: "secret", value: "env:OPENAI_API_KEY" },
    ];
  },
  async test(c: Connection): Promise<ConnectorTest> {
    const baseUrl = (fieldValue(c, "base_url") ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const keyRef = fieldValue(c, "api_key");
    const key = resolveSecret(keyRef);
    if (!key.ok) return { ok: false, reason: `api_key: ${key.reason} (${key.detail})` };

    try {
      const res = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: { authorization: `Bearer ${key.value}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status} from ${baseUrl}/models` };
      const body = (await res.json()) as { data?: Array<{ id: string }> };
      const count = Array.isArray(body.data) ? body.data.length : 0;
      return { ok: true, detail: `auth ok · ${count} models visible` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }
  },
};
