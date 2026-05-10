/**
 * Pure cache transforms used by the Approvals optimistic mutation. Extracted
 * from the React layer so they can be unit-tested without spinning up a
 * QueryClient + tRPC.
 */

export type InboxLike = {
  counts: { pending: number; autoApproved24h: number; blocked24h: number };
  queue: Array<{ id: string; [k: string]: unknown }>;
  recent: unknown[];
  policies: unknown[];
};

/** Remove the approval row by id and decrement the pending counter. Pure. */
export function removeApprovalById<T extends InboxLike>(inbox: T, id: string): T {
  const queue = inbox.queue.filter((row) => row.id !== id);
  if (queue.length === inbox.queue.length) return inbox;
  return {
    ...inbox,
    queue,
    counts: { ...inbox.counts, pending: Math.max(0, inbox.counts.pending - 1) },
  };
}
