/**
 * Pure helper used by Heatmap to bucket a 0..1 value into one of 5 levels.
 * Extracted from React for unit-testing.
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
