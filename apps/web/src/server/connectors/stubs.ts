/**
 * Stub connector definitions.
 *
 * Each entry declares a name, category, and field shape so operators can
 * add a connection of this type from the New connection dialog — but no
 * `test()` implementation exists yet, so the connector reports
 * `{ ok: false, reason: "stub" }` and the Test button stays unavailable
 * in the UI.
 *
 * These exist so the configuration surface isn't gated on connector
 * implementation order — an operator who wants to put their Slack bot
 * token in `env:SLACK_BOT_TOKEN` shouldn't need to wait for a Slack
 * connector to land.
 */

import type { Connector, ConnectorTest } from "./types";
import type { ConnectionField } from "@/server/mock/seed";

function stub(opts: {
  id: string;
  name: string;
  category: string;
  fields: () => ConnectionField[];
  requiredFieldKeys?: readonly string[];
}): Connector {
  return {
    id: opts.id,
    name: opts.name,
    category: opts.category,
    requiredFieldKeys: opts.requiredFieldKeys ?? [],
    implemented: false,
    defaultFields: opts.fields,
    async test(): Promise<ConnectorTest> {
      return { ok: false, reason: "stub — no connector implementation yet" };
    },
  };
}

export const STUB_CONNECTORS: readonly Connector[] = [
  stub({
    id: "pagerduty",
    name: "PagerDuty",
    category: "Notifications",
    requiredFieldKeys: ["service_key"],
    fields: () => [
      { k: "service_key", label: "Service key", type: "secret", value: "env:PAGERDUTY_SERVICE_KEY" },
    ],
  }),
  stub({
    id: "vault",
    name: "HashiCorp Vault",
    category: "Secrets",
    requiredFieldKeys: ["addr", "token"],
    fields: () => [
      { k: "addr", label: "Address", type: "url", value: "https://vault.internal" },
      { k: "token", label: "Token", type: "secret", value: "env:VAULT_TOKEN" },
    ],
  }),
  stub({
    id: "datadog",
    name: "Datadog",
    category: "Observability",
    requiredFieldKeys: ["api_key"],
    fields: () => [
      { k: "api_key", label: "API key", type: "secret", value: "env:DATADOG_API_KEY" },
    ],
  }),
  stub({
    id: "opensearch",
    name: "OpenSearch",
    category: "Data",
    requiredFieldKeys: ["host"],
    fields: () => [
      { k: "host", label: "Host", type: "url", value: "" },
    ],
  }),
  stub({
    id: "stripe",
    name: "Stripe",
    category: "Billing",
    requiredFieldKeys: ["api_key"],
    fields: () => [
      { k: "api_key", label: "API key", type: "secret", value: "env:STRIPE_API_KEY" },
    ],
  }),
  stub({
    id: "n8n",
    name: "n8n automations",
    category: "Automations",
    requiredFieldKeys: ["base_url", "api_key"],
    fields: () => [
      { k: "base_url", label: "Base URL", type: "url", value: "" },
      { k: "api_key", label: "API key", type: "secret", value: "env:N8N_API_KEY" },
      { k: "webhook_secret", label: "Webhook secret", type: "secret", value: "env:N8N_WEBHOOK_SECRET" },
    ],
  }),
];
