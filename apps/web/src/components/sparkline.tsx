type Tone = "ok" | "warn" | "bad" | "info" | "violet";

const STROKE: Record<Tone, string> = {
  ok: "var(--spark-ok)",
  warn: "var(--spark-warn)",
  bad: "var(--spark-bad)",
  info: "var(--spark-info)",
  violet: "var(--spark-violet)",
};

/** Tiny SVG sparkline — no axes, no tooltip, no animation. */
export function Sparkline({
  values,
  tone = "info",
  width = 96,
  height = 24,
  className,
}: {
  values: number[];
  tone?: Tone;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length === 0) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const dx = width / Math.max(1, values.length - 1);
  const points = values
    .map((v, i) => `${(i * dx).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
      preserveAspectRatio="none"
    >
      <polyline points={points} fill="none" stroke={STROKE[tone]} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
