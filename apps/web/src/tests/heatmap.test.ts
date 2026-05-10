import { describe, it, expect } from "vitest";
import { heatBucket } from "@/components/heatmap-utils";

describe("heatmap bucketing", () => {
  it("places values in the documented 5 buckets", () => {
    expect(heatBucket(0)).toBe(0);
    expect(heatBucket(0.19)).toBe(0);
    expect(heatBucket(0.2)).toBe(1);
    expect(heatBucket(0.39)).toBe(1);
    expect(heatBucket(0.4)).toBe(2);
    expect(heatBucket(0.59)).toBe(2);
    expect(heatBucket(0.6)).toBe(3);
    expect(heatBucket(0.79)).toBe(3);
    expect(heatBucket(0.8)).toBe(4);
    expect(heatBucket(1)).toBe(4);
  });

  it("treats negative + non-finite as bucket 0", () => {
    expect(heatBucket(-0.1)).toBe(0);
    expect(heatBucket(Number.NaN)).toBe(0);
    expect(heatBucket(Number.POSITIVE_INFINITY)).toBe(4);
  });
});
