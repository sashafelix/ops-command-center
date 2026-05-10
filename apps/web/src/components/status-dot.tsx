import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad" | "info" | "violet";

const DOT: Record<Tone, string> = {
  ok: "dot-ok",
  warn: "dot-warn",
  bad: "dot-bad",
  info: "dot-info",
  violet: "dot-violet",
};

/** Colored dot + label — never color alone (a11y per HANDOFF §3). */
export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: Tone;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("dot", DOT[tone])} aria-hidden />
      <span className="text-12">{label}</span>
    </span>
  );
}
