import { describe, it, expect } from "vitest";
import { removeApprovalById, type InboxLike } from "@/components/approvals/optimistic";

const seed: InboxLike = {
  counts: { pending: 3, autoApproved24h: 100, blocked24h: 2 },
  queue: [
    { id: "apr_1", policy: "destructive-write" },
    { id: "apr_2", policy: "secret-touch" },
    { id: "apr_3", policy: "external-network" },
  ],
  recent: [],
  policies: [],
};

describe("approvals optimistic cache transform", () => {
  it("removes the matching row and decrements pending", () => {
    const next = removeApprovalById(seed, "apr_2");
    expect(next.queue.map((r) => r.id)).toEqual(["apr_1", "apr_3"]);
    expect(next.counts.pending).toBe(2);
    expect(next.counts.autoApproved24h).toBe(100);
  });

  it("returns the same reference when id is unknown (no-op)", () => {
    const next = removeApprovalById(seed, "apr_999");
    expect(next).toBe(seed);
  });

  it("clamps pending at zero", () => {
    const empty: InboxLike = { ...seed, queue: [{ id: "apr_solo" }], counts: { ...seed.counts, pending: 0 } };
    const next = removeApprovalById(empty, "apr_solo");
    expect(next.counts.pending).toBe(0);
    expect(next.queue).toEqual([]);
  });

  it("does not mutate the original (rollback safety)", () => {
    const before = JSON.stringify(seed);
    removeApprovalById(seed, "apr_1");
    expect(JSON.stringify(seed)).toBe(before);
  });
});
