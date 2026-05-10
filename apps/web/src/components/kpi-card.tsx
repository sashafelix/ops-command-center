import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

export function KpiCard({
  label,
  value,
  delta,
  spark,
  tone = "info",
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  spark?: number[];
  tone?: "ok" | "warn" | "bad" | "info" | "violet";
  className?: string;
}) {
  return (
    <div className={cn("panel p-3 flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] tracking-widest text-fg-faint uppercase">
          {label}
        </span>
        {delta && <span className="font-mono text-11 text-fg-muted num">{delta}</span>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-fg text-[20px] font-semibold tracking-tight num">{value}</span>
        {spark && spark.length > 0 && <Sparkline values={spark} tone={tone} />}
      </div>
    </div>
  );
}
