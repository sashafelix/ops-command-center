import { cn } from "@/lib/utils";
import { heatBucket, HEAT_VAR } from "./heatmap-utils";

export type HeatmapRow = {
  /** Row label rendered to the left of the cells. */
  label: string;
  /** Cell values in [0,1]. */
  values: number[];
  /** Optional summary in the right gutter (e.g. running total). */
  summary?: string;
};

/**
 * Compact heat grid used by Trust threats, Status uptime, Infra CPU.
 * - No tooltips (motion budget); cell title= attribute carries the value.
 * - Cells are square at the configured size; the grid is fixed-pitch so the
 *   sum across all rows is interpretable.
 */
export function Heatmap({
  rows,
  cellSize = 14,
  gap = 2,
  className,
  ariaLabel,
}: {
  rows: HeatmapRow[];
  cellSize?: number;
  gap?: number;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} aria-label={ariaLabel} role="img">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <div className="text-12 text-fg-muted w-32 shrink-0 truncate">{r.label}</div>
          <div className="flex" style={{ gap }}>
            {r.values.map((v, i) => {
              const b = heatBucket(v);
              return (
                <span
                  key={i}
                  title={`${r.label} · ${i}: ${v.toFixed(3)}`}
                  className="inline-block"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    background: HEAT_VAR[b],
                    borderRadius: 2,
                  }}
                />
              );
            })}
          </div>
          {r.summary && (
            <div className="ml-auto font-mono text-11 text-fg-muted num">{r.summary}</div>
          )}
        </div>
      ))}
    </div>
  );
}
