import { describe, it, expect } from "vitest";
import { heatBucket, uptimeBucket } from "@/components/heatmap-utils";

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

describe("uptime bucketing", () => {
  it("inverse-semantics: high uptime is bucket 0, low is bucket 4", () => {
    expect(uptimeBucket(1)).toBe(0);
    expect(uptimeBucket(0.999)).toBe(0);
    expect(uptimeBucket(0.9989)).toBe(1);
    expect(uptimeBucket(0.99)).toBe(1);
    expect(uptimeBucket(0.989)).toBe(2);
    expect(uptimeBucket(0.95)).toBe(2);
    expect(uptimeBucket(0.949)).toBe(3);
    expect(uptimeBucket(0.9)).toBe(3);
    expect(uptimeBucket(0.899)).toBe(4);
    expect(uptimeBucket(0)).toBe(4);
  });

  it("treats NaN as worst (bucket 4)", () => {
    expect(uptimeBucket(Number.NaN)).toBe(4);
  });
});
