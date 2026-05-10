import { describe, it, expect } from "vitest";
import { buildAuditRow, computeAuditHash, verifyChain, type AuditRow } from "@ops/shared";

async function buildChain(n: number): Promise<AuditRow[]> {
  const rows: AuditRow[] = [];
  let prev = "";
  for (let i = 0; i < n; i++) {
    const row = await buildAuditRow(prev, {
      id: `evt_${i}`,
      ts: new Date(1700000000000 + i * 1000).toISOString(),
      actor: i % 2 === 0 ? "mara@ops" : "devon@ops",
      role: "admin",
      action: "approval.approve",
      target: `approval/apr_${i}`,
      ip: `10.0.0.${i % 256}`,
      ua: "ops-web/1.0",
    });
    rows.push(row);
    prev = row.hash;
  }
  return rows;
}

describe("audit chain", () => {
  it("computes hash = SHA-256(prev || canonical_json(body))", async () => {
    const body = {
      id: "evt_x",
      ts: "2026-05-10T09:00:00Z",
      actor: "mara@ops",
      role: "admin",
      action: "approval.approve",
      target: "approval/apr_1",
      ip: "10.0.0.1",
      ua: "ops-web/1.0",
    };
    const h1 = await computeAuditHash("", body);
    const h2 = await computeAuditHash("", body);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies a valid chain end-to-end", async () => {
    const rows = await buildChain(50);
    const result = await verifyChain(rows);
    expect(result.ok).toBe(true);
    expect(result.rowsChecked).toBe(50);
  });

  it("flags prev_hash_mismatch when a row is unlinked from its predecessor", async () => {
    const rows = await buildChain(20);
    const tampered: AuditRow[] = [...rows];
    tampered[10] = { ...tampered[10]!, prev_hash: "cafebabe" };
    const result = await verifyChain(tampered);
    expect(result.ok).toBe(false);
    expect(result.firstBad).toBe(10);
    expect(result.reason).toBe("prev_hash_mismatch");
  });

  it("flags computed_mismatch when a row's body is mutated", async () => {
    const rows = await buildChain(20);
    const tampered: AuditRow[] = [...rows];
    tampered[7] = { ...tampered[7]!, action: "approval.deny" };
    const result = await verifyChain(tampered);
    expect(result.ok).toBe(false);
    expect(result.firstBad).toBe(7);
    expect(result.reason).toBe("computed_mismatch");
  });

  it("verifies 1000 rows in well under 300ms (HANDOFF §10 acceptance)", async () => {
    const rows = await buildChain(1000);
    const t0 = performance.now();
    const result = await verifyChain(rows);
    const elapsed = performance.now() - t0;
    expect(result.ok).toBe(true);
    expect(result.rowsChecked).toBe(1000);
    expect(elapsed).toBeLessThan(300);
  }, 5000);
});
