import { describe, it, expect } from "vitest";
import { hashToken, generateRawToken, hasScope } from "@/server/api-tokens";

describe("api-tokens helpers", () => {
  it("hashes deterministically and produces 64 hex chars", () => {
    const a = hashToken("ops_live_aaaaaaaaaaaa");
    const b = hashToken("ops_live_aaaaaaaaaaaa");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a different hash for a different token", () => {
    expect(hashToken("ops_live_a")).not.toBe(hashToken("ops_live_b"));
  });

  it("generates well-formed raw tokens", () => {
    const t = generateRawToken("live");
    expect(t).toMatch(/^ops_live_[a-z0-9]{32}$/);
    expect(t).not.toBe(generateRawToken("live"));
  });

  it("scope check: exact match", () => {
    expect(hasScope(["sessions.write"], "sessions.write")).toBe(true);
    expect(hasScope(["approvals.write"], "sessions.write")).toBe(false);
  });

  it("scope check: wildcard satisfies anything", () => {
    expect(hasScope(["*"], "sessions.write")).toBe(true);
    expect(hasScope(["*"], "approvals.write")).toBe(true);
  });

  it("scope check: empty set denies", () => {
    expect(hasScope([], "sessions.write")).toBe(false);
  });
});
