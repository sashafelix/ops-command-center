import type { Connector } from "./types";
import { anthropicConnector } from "./anthropic";
import { datadogConnector } from "./datadog";
import { githubConnector } from "./github";
import { httpConnector } from "./http";
import { n8nConnector } from "./n8n";
import { openaiConnector } from "./openai";
import { opensearchConnector } from "./opensearch";
import { pagerdutyConnector } from "./pagerduty";
import { proxmoxConnector } from "./proxmox";
import { slackConnector } from "./slack";
import { stripeConnector } from "./stripe";
import { vaultConnector } from "./vault";

/**
 * Single source of truth: every connector type the workspace knows about,
 * keyed by id. All connectors are implemented — the previous stubs file
 * is gone.
 */
const ALL: Connector[] = [
  anthropicConnector,
  datadogConnector,
  githubConnector,
  httpConnector,
  n8nConnector,
  openaiConnector,
  opensearchConnector,
  pagerdutyConnector,
  proxmoxConnector,
  slackConnector,
  stripeConnector,
  vaultConnector,
];

export const CONNECTORS: Readonly<Record<string, Connector>> = Object.freeze(
  Object.fromEntries(ALL.map((c) => [c.id, c])),
);

export function connectorFor(id: string): Connector | undefined {
  return CONNECTORS[id];
}

/** All connector types — used by the "New connection" picker. */
export function listConnectorTypes(): Connector[] {
  return Object.values(CONNECTORS);
}
