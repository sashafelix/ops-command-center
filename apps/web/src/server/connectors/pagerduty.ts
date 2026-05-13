import { resolveSecret } from "./secrets";
import { fieldValue, type Connector, type ConnectorTest } from "./types";
import type { Connection } from "@/server/mock/seed";

/**
 * PagerDuty REST API connector.
 *
 * Field is `api_token` — a PagerDuty REST API user token, NOT the
 * Events API v2 integration key. The Events key is for firing alerts;
 * the REST token is for reading + writing PD resources. We test against
 * GET /abilities which doesn't require any specific scope and returns
 * a JSON list of features available on the account.
 *
 * For sending alerts later (incident.opened → page oncall), we'll add a
 * second field `events_routing_key`.
 */
export const pagerdutyConnector: Connector = {
  id: "pagerduty",
  name: "PagerDuty",
  category: "Notifications",
  requiredFieldKeys: ["api_token"],
  implemented: true,
  defaultFields() {
    return [
      { k: "api_token", label: "REST API token", type: "secret", value: "env:PAGERDUTY_API_TOKEN" },
      { k: "events_routing_key", label: "Events routing key", type: "secret", value: "env:PAGERDUTY_EVENTS_KEY" },
    ];
  },
  async test(c: Connection): Promise<ConnectorTest> {
    const tokRef = fieldValue(c, "api_token");
    const tok = resolveSecret(tokRef);
    if (!tok.ok) return { ok: false, reason: `api_token: ${tok.reason} (${tok.detail})` };

    try {
      const res = await fetch("https://api.pagerduty.com/abilities", {
        method: "GET",
        headers: {
          authorization: `Token token=${tok.value}`,
          accept: "application/vnd.pagerduty+json;version=2",
        },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status} from api.pagerduty.com/abilities` };
      const body = (await res.json()) as { abilities?: string[] };
      const n = Array.isArray(body.abilities) ? body.abilities.length : 0;
      return { ok: true, detail: `auth ok · ${n} abilities` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }
  },
};
