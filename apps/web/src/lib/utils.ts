import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function fmtDur(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m${String(ss).padStart(2, "0")}s`;
  if (m > 0) return `${m}m${String(ss).padStart(2, "0")}s`;
  return `${ss}s`;
}

export function fmtUSD(n: number): string {
  return `$${n.toFixed(2)}`;
}
