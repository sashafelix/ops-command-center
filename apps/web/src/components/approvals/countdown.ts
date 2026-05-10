"use client";

import { useEffect, useState } from "react";
import { fmtDur } from "@/lib/utils";

/** Returns seconds remaining until the ISO timestamp, ticking every second. */
export function useCountdown(autoDenyAt: string): number {
  const target = new Date(autoDenyAt).getTime();
  const [remainingS, setRemainingS] = useState(() => Math.max(0, Math.floor((target - Date.now()) / 1000)));
  useEffect(() => {
    const id = setInterval(() => {
      setRemainingS(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remainingS;
}

/** Pure helper for tests — no React. */
export function secondsUntil(autoDenyAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((new Date(autoDenyAt).getTime() - now) / 1000));
}

export function fmtCountdown(seconds: number): string {
  return fmtDur(seconds);
}
