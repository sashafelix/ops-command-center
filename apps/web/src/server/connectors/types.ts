/**
 * Connector interface — every real source (Anthropic, GitHub, Proxmox, etc.)
 * implements this so the routers + sync workers can treat them uniformly.
 */

import type { Connection } from "@/server/mock/seed";

export type ConnectorTest =
  | { ok: true; detail: string }
  | { ok: false; reason: string };

export interface Connector {
  /** Stable id matching the connections row id. */
  readonly id: string;
  /**
   * Cheap reachability check: validates credentials, returns a short detail
   * line that surfaces under the connection card.
   */
  test(c: Connection): Promise<ConnectorTest>;
}

/** Lookup a field by key on a Connection row. */
export function fieldValue(c: Connection, key: string): string | undefined {
  return c.fields.find((f) => f.k === key)?.value;
}
