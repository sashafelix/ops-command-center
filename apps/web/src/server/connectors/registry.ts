import type { Connector } from "./types";
import { anthropicConnector } from "./anthropic";
import { githubConnector } from "./github";
import { proxmoxConnector } from "./proxmox";
import { STUB_CONNECTORS } from "./stubs";

/**
 * Single source of truth: every connector type the workspace knows about,
 * keyed by id. Implemented connectors expose a real `test()`; stubs
 * report "stub — no connector implementation yet" so the UI can disable
 * the Test button but still allow configuration.
 */
const ALL: Connector[] = [
  anthropicConnector,
  githubConnector,
  proxmoxConnector,
  ...STUB_CONNECTORS,
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
