/**
 * MTD burn chart — area + cap line + today marker. Hand-drawn SVG (no axes,
 * no tooltips beyond the title attribute) per HANDOFF motion budget.
 */
export function MtdBurnChart({
  daily,
  capLine,
  width = 720,
  height = 160,
}: {
  daily: number[];
  capLine: number;
  width?: number;
  height?: number;
}) {
  if (daily.length === 0) return <svg width={width} height={height} aria-hidden />;

  const padX = 8;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const max = Math.max(capLine * 1.1, ...daily);
  const dx = innerW / Math.max(1, daily.length - 1);
  const yFor = (v: number) => padY + innerH - (v / max) * innerH;

  const linePoints = daily
    .map((v, i) => `${(padX + i * dx).toFixed(1)},${yFor(v).toFixed(1)}`)
    .join(" ");

  // Area fill = line + bottom edge
  const areaPoints =
    `${padX.toFixed(1)},${yFor(0).toFixed(1)} ` +
    linePoints +
    ` ${(padX + (daily.length - 1) * dx).toFixed(1)},${yFor(0).toFixed(1)}`;

  const todayX = padX + (daily.length - 1) * dx;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="MTD burn"
    >
      {/* Area */}
      <polygon points={areaPoints} fill="rgb(var(--info) / 0.10)" />
      {/* Spend line */}
      <polyline points={linePoints} fill="none" stroke="rgb(var(--info))" strokeWidth={1.25} strokeLinejoin="round" />
      {/* Cap line */}
      <line
        x1={padX}
        x2={padX + innerW}
        y1={yFor(capLine)}
        y2={yFor(capLine)}
        stroke="rgb(var(--warn))"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {/* Today marker */}
      <line
        x1={todayX}
        x2={todayX}
        y1={padY}
        y2={padY + innerH}
        stroke="var(--ticked-line)"
        strokeWidth={1}
      />
      <circle cx={todayX} cy={yFor(daily[daily.length - 1] ?? 0)} r={2.5} fill="rgb(var(--info))" />
    </svg>
  );
}
