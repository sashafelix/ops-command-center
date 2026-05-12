/**
 * Pure helper used by Heatmap to bucket a 0..1 value into one of 5 levels.
 * Extracted from React for unit-testing.
 *
 * Used in the default "heat" mode where 0 = cold (good for CPU, threats) and
 * 1 = hot (bad). For uptime, where high = good, see `uptimeBucket`.
 */
export function heatBucket(value: number): 0 | 1 | 2 | 3 | 4 {
  if (Number.isNaN(value) || value < 0.2) return 0;
  if (value < 0.4) return 1;
  if (value < 0.6) return 2;
  if (value < 0.8) return 3;
  return 4;
}

export const HEAT_VAR: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "var(--heat-0)",
  1: "var(--heat-1)",
  2: "var(--heat-2)",
  3: "var(--heat-3)",
  4: "var(--heat-4)",
};

/**
 * Bucket for uptime ratios. Inverse semantics: high values are good.
 *
 *   ≥ 99.9%  → ok  (green)
 *   ≥ 99.0%  → ok-dim (subtle green / muted)
 *   ≥ 95.0%  → warn (yellow)
 *   ≥ 90.0%  → bad-dim
 *   <  90%   → bad  (red)
 *
 * Three semantic buckets — the heat scale would just collapse everything
 * into "good" because every uptime value lives in [0.95, 1.0].
 */
export function uptimeBucket(value: number): 0 | 1 | 2 | 3 | 4 {
  if (Number.isNaN(value)) return 4;
  if (value >= 0.999) return 0;
  if (value >= 0.99) return 1;
  if (value >= 0.95) return 2;
  if (value >= 0.9) return 3;
  return 4;
}

export const UPTIME_VAR: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "rgb(var(--ok))",
  1: "rgb(var(--ok) / 0.55)",
  2: "rgb(var(--warn))",
  3: "rgb(var(--bad) / 0.55)",
  4: "rgb(var(--bad))",
};
