/**
 * The set of audit-event actions a webhook can subscribe to.
 *
 * Listed values must match actions that actually emit somewhere in the
 * codebase — see grep for `appendAuditEvent` calls. Plus the special
 * `audit.row` wildcard, which fires for every audit event (set up by
 * audit-append.ts's enqueue logic).
 *
 * Shared between Settings → Webhooks (where you edit a single webhook's
 * subscriptions) and Settings → Notifications (the routing matrix view).
 */
export const NOTIFICATION_EVENTS = [
  "audit.row", //              catch-all: every audit event
  "approval.approve",
  "approval.deny",
  "agent.rollback",
  "evals.run",
  "connection.test.fail",
  "connection.test.ok",
  "connection.create",
  "connection.delete",
  "token.create",
  "token.revoke",
  "member.invite",
  "runtime.pause-all", //      kill switch fired
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];
