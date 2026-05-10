import type { Role } from "@ops/shared";

/**
 * Role hierarchy for routine RBAC checks. Higher = more capable.
 *
 * - viewer:  read-only across the dashboard
 * - analyst: read-only + can run evals (consumes budget)
 * - sre:     can decide approvals, rollback, toggle webhooks
 * - admin:   destructive workspace operations (pause-all, danger zone)
 * - agent:   service principal — orthogonal to UI roles, denied UI mutations
 */
const RANK: Record<Role, number> = {
  viewer: 0,
  analyst: 1,
  sre: 2,
  admin: 3,
  agent: -1, // never satisfies a "user" requirement
};

/** Pure predicate: does `actual` meet the `required` bar? Used for tests. */
export function hasRole(actual: Role | undefined, required: Role): boolean {
  if (!actual) return false;
  const a = RANK[actual];
  const r = RANK[required];
  if (a < 0) return false;
  return a >= r;
}
