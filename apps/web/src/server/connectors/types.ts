/**
 * Connector interface — every real source (Anthropic, GitHub, Proxmox, etc.)
 * implements this so the routers + sync workers can treat them uniformly.
 */

import type { Connection, ConnectionField } from "@/server/mock/seed";

export type ConnectorTest =
  | { ok: true; detail: string }
  | { ok: false; reason: string };

export interface Connector {
  /** Stable id used as the connections row id (and lookup key). */
  readonly id: string;
  /** Display name shown in the "New connection" picker. */
  readonly name: string;
  /** Category bucket the card lives in on the Connections grid. */
  readonly category: string;
  /**
   * Required field keys — saveConnection refuses to mark a connection
   * "verified" if any of these are empty.
   */
  readonly requiredFieldKeys: readonly string[];
  /**
   * True when a real `test()` exists. Stub types still expose the field
   * shape (so operators can configure them) but `test()` returns
   * { ok: false, reason: "stub" }. The UI uses this flag to disable the
   * Test button and render a "no connector" label.
   */
  readonly implemented: boolean;
  /**
   * Field shape used when an operator creates a fresh connection of this
   * type from the UI. Values are starter defaults (URLs may be filled in,
   * secrets typically blank or `env:NAME`).
   */
  defaultFields(): ConnectionField[];
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

/** True if every required field has a non-empty value. */
export function hasRequiredFields(c: Connection, requiredKeys: readonly string[]): boolean {
  for (const k of requiredKeys) {
    const v = fieldValue(c, k);
    if (v === undefined || v.trim() === "") return false;
  }
  return true;
}
