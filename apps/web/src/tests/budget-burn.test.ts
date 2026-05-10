import { describe, it, expect } from "vitest";
import { burnPct, burnTone } from "@/components/budget/burn";

describe("budget burn helpers", () => {
  it("returns 0 when cap is non-positive", () => {
    expect(burnPct(50, 0)).toBe(0);
    expect(burnPct(50, -10)).toBe(0);
  });

  it("rounds the percentage to an int", () => {
    expect(burnPct(33, 100)).toBe(33);
    expect(burnPct(0.166, 1)).toBe(17);
  });

  it("clamps at 100% even when over budget", () => {
    expect(burnPct(214.02, 200)).toBe(100);
  });

  it("derives tone: ok < 80% < warn < 100% < bad", () => {
    expect(burnTone(50, 100)).toBe("ok");
    expect(burnTone(80, 100)).toBe("warn");
    expect(burnTone(99.9, 100)).toBe("warn");
    expect(burnTone(100, 100)).toBe("bad");
    expect(burnTone(214.02, 200)).toBe("bad");
  });

  it("returns 'ok' when cap is non-positive", () => {
    expect(burnTone(50, 0)).toBe("ok");
  });
});
