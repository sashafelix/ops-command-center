/**
 * Derive a connection's display status from real signals — not from
 * whatever the seed happened to write.
 *
 * Inputs:
 *   - connector existence (is there code that can talk to this thing?)
 *   - field completeness (are required fields non-empty?)
 *   - last test result + freshness (did Test pass recently?)
 *
 * Pure function so it can be unit-tested + called from both routers and
 * mutations consistently.
 */

import { connectorFor } from "./registry";
import { hasRequiredFields } from "./types";
import type { Connection } from "@/server/mock/seed";

export type DisplayStatus =
  | "stub" //         no connector implemented yet
  | "incomplete" //   connector exists, required fields missing
  | "unverified" //   complete, never tested OR test is stale
  | "connected" //    last test passed within the freshness window
  | "needs-attention"; // last test failed

export type DisplayHealth = "ok" | "warn" | "bad" | "info" | "violet";

/** How long a successful test counts as "still good". */
export const FRESH_TEST_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DerivableConnection = Pick<Connection, "id" | "fields"> & {
  last_test_at?: Date | string | null;
  last_test_ok?: boolean | null;
};

export function deriveStatus(c: DerivableConnection): {
  status: DisplayStatus;
  health: DisplayHealth;
} {
  const connector = connectorFor(c.id);

  if (!connector) {
    return { status: "stub", health: "warn" };
  }

  if (!hasRequiredFields(c as Connection, connector.requiredFieldKeys)) {
    return { status: "incomplete", health: "warn" };
  }

  if (c.last_test_at == null || c.last_test_ok == null) {
    return { status: "unverified", health: "warn" };
  }

  const atMs =
    typeof c.last_test_at === "string"
      ? Date.parse(c.last_test_at)
      : c.last_test_at.getTime();
  const fresh = Date.now() - atMs < FRESH_TEST_WINDOW_MS;

  if (c.last_test_ok && fresh) {
    return { status: "connected", health: "ok" };
  }
  if (c.last_test_ok && !fresh) {
    // Old success — treat as unverified so the operator knows to re-test.
    return { status: "unverified", health: "warn" };
  }
  return { status: "needs-attention", health: "bad" };
}
