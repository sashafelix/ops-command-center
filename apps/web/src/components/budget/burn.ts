/** Returns the burn percentage clamped to [0,100], rounded to int. */
export function burnPct(spend: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((spend / cap) * 100)));
}

/** Tone derivation for a burn ratio: warn at 80%+, bad at 100%+. */
export function burnTone(spend: number, cap: number): "ok" | "warn" | "bad" {
  if (cap <= 0) return "ok";
  const r = spend / cap;
  if (r >= 1) return "bad";
  if (r >= 0.8) return "warn";
  return "ok";
}
