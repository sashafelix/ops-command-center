import { resolveSecret } from "./secrets";
import { fieldValue, type Connector, type ConnectorTest } from "./types";
import type { Connection } from "@/server/mock/seed";

/**
 * Stripe API connector.
 *
 * Test calls GET /v1/balance which is a low-privilege read available
 * on any restricted key with "balance: read" scope (or any full key).
 * Returns livemode + currencies, which tells the operator at a glance
 * whether they're pointed at test or live mode.
 */
export const stripeConnector: Connector = {
  id: "stripe",
  name: "Stripe",
  category: "Billing",
  requiredFieldKeys: ["api_key"],
  implemented: true,
  defaultFields() {
    return [
      { k: "api_key", label: "API key", type: "secret", value: "env:STRIPE_API_KEY" },
    ];
  },
  async test(c: Connection): Promise<ConnectorTest> {
    const keyRef = fieldValue(c, "api_key");
    const key = resolveSecret(keyRef);
    if (!key.ok) return { ok: false, reason: `api_key: ${key.reason} (${key.detail})` };

    try {
      const res = await fetch("https://api.stripe.com/v1/balance", {
        method: "GET",
        headers: { authorization: `Bearer ${key.value}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: { message?: string } };
          if (body.error?.message) detail += ` · ${body.error.message}`;
        } catch {
          /* non-json error body — keep the status */
        }
        return { ok: false, reason: `${detail} from api.stripe.com/v1/balance` };
      }
      const body = (await res.json()) as {
        livemode?: boolean;
        available?: Array<{ currency: string }>;
      };
      const currencies = (body.available ?? []).map((a) => a.currency.toUpperCase());
      const mode = body.livemode ? "LIVE" : "test";
      return {
        ok: true,
        detail: `${mode} · currencies [${currencies.slice(0, 3).join(", ")}${currencies.length > 3 ? ", …" : ""}]`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }
  },
};
