import { resolveSecret } from "./secrets";
import { fieldValue, type Connector, type ConnectorTest } from "./types";
import type { Connection } from "@/server/mock/seed";

/**
 * OpenSearch / Elasticsearch connector.
 *
 * Test calls /_cluster/health, which works on both OpenSearch and ES,
 * returns status (green / yellow / red) + active shard counts. Basic
 * auth is optional — many internal clusters run without it; managed
 * services typically require it.
 */
export const opensearchConnector: Connector = {
  id: "opensearch",
  name: "OpenSearch",
  category: "Data",
  requiredFieldKeys: ["host"],
  implemented: true,
  defaultFields() {
    return [
      { k: "host",     label: "Host",     type: "url",    value: "" },
      { k: "username", label: "Username", type: "string", value: "" },
      { k: "password", label: "Password", type: "secret", value: "env:OPENSEARCH_PASSWORD" },
    ];
  },
  async test(c: Connection): Promise<ConnectorTest> {
    const host = (fieldValue(c, "host") ?? "").trim().replace(/\/+$/, "");
    if (!host) return { ok: false, reason: "host is required" };
    if (!/^https?:\/\//i.test(host)) return { ok: false, reason: "host must start with http(s)://" };

    const username = (fieldValue(c, "username") ?? "").trim();
    const passwordRef = fieldValue(c, "password");

    const headers: Record<string, string> = { accept: "application/json" };
    if (username) {
      const pw = resolveSecret(passwordRef);
      if (!pw.ok) return { ok: false, reason: `password: ${pw.reason} (${pw.detail})` };
      const credentials = Buffer.from(`${username}:${pw.value}`).toString("base64");
      headers.authorization = `Basic ${credentials}`;
    }

    try {
      const res = await fetch(`${host}/_cluster/health`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status} from ${host}/_cluster/health` };
      const body = (await res.json()) as {
        status?: string;
        cluster_name?: string;
        active_shards?: number;
      };
      const status = body.status ?? "?";
      const name = body.cluster_name ?? "?";
      const shards = body.active_shards ?? 0;
      return { ok: true, detail: `${name} · ${status} · ${shards} active shards` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }
  },
};
