import type { Connector } from "./types";
import { anthropicConnector } from "./anthropic";
import { githubConnector } from "./github";
import { proxmoxConnector } from "./proxmox";

/**
 * Single source of truth: which connection id maps to which connector.
 * Connections not listed here are configurable-but-stubbed.
 */
export const CONNECTORS: Readonly<Record<string, Connector>> = {
  anthropic: anthropicConnector,
  github: githubConnector,
  proxmox: proxmoxConnector,
};

export function connectorFor(id: string): Connector | undefined {
  return CONNECTORS[id];
}

/** All connector types operators can add a new instance of from the UI. */
export function listConnectorTypes(): Connector[] {
  return Object.values(CONNECTORS);
}
