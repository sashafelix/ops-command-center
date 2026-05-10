import { burnPct, burnTone } from "./burn";
import { cn } from "@/lib/utils";

const FILL: Record<"ok" | "warn" | "bad", string> = {
  ok: "rgb(var(--ok))",
  warn: "rgb(var(--warn))",
  bad: "rgb(var(--bad))",
};

export function BurnBar({
  spend,
  cap,
  className,
}: {
  spend: number;
  cap: number;
  className?: string;
}) {
  const pct = burnPct(spend, cap);
  const tone = burnTone(spend, cap);
  return (
    <div className={cn("w-full h-1.5 bg-ink-3 rounded-full overflow-hidden", className)}>
      <div className="h-full" style={{ width: `${pct}%`, background: FILL[tone] }} />
    </div>
  );
}
