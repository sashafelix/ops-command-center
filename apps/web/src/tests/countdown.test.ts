import { describe, it, expect } from "vitest";
import { secondsUntil, fmtCountdown } from "@/components/approvals/countdown";

describe("approval auto-deny countdown", () => {
  it("returns the floor of seconds remaining", () => {
    const now = Date.parse("2026-05-10T12:00:00Z");
    const target = new Date(now + 4 * 60_000 + 18_500).toISOString();
    expect(secondsUntil(target, now)).toBe(258);
  });

  it("clamps to zero past expiry", () => {
    const now = Date.parse("2026-05-10T12:00:00Z");
    const target = new Date(now - 10_000).toISOString();
    expect(secondsUntil(target, now)).toBe(0);
  });

  it("formats the countdown as MmSSs", () => {
    expect(fmtCountdown(258)).toBe("4m18s");
    expect(fmtCountdown(0)).toBe("0s");
    expect(fmtCountdown(59)).toBe("59s");
  });
});
