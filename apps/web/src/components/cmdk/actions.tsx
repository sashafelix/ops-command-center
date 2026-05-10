"use client";

import { useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";

/**
 * Phase 5: first-class palette actions per HANDOFF §7.
 * Each maps to a tRPC mutation, gated through the re-auth modal when destructive.
 */
export type PaletteAction = {
  id: string;
  label: string;
  /** When set, palette shows a "destructive" hint and routes through reauth. */
  destructive?: boolean;
  run: () => Promise<void>;
};

export function usePaletteActions(): PaletteAction[] {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();

  const pauseAll = trpc.runtime.pauseAll.useMutation({
    onSuccess: () => void utils.runtime.state.invalidate(),
  });
  const runSuite = trpc.evals.runSuite.useMutation();

  const onPauseAll = useCallback(async () => {
    const ok = await requireFreshAuth("Confirm to pause all agents across the workspace.");
    if (!ok) return;
    await pauseAll.mutateAsync({ paused: true });
  }, [pauseAll, requireFreshAuth]);

  const onRunAuthRegression = useCallback(async () => {
    const ok = await requireFreshAuth("Confirm to enqueue auth-suite regression run.");
    if (!ok) return;
    await runSuite.mutateAsync({ suite_id: "auth-suite" });
  }, [runSuite, requireFreshAuth]);

  const onPageOnCall = useCallback(async () => {
    // Phase 6 wires this to PagerDuty via /api/integrations/pagerduty/incident.
    // Here it's a no-op confirmation so the palette flow works end-to-end.
    const ok = await requireFreshAuth("Page the on-call rotation right now?");
    if (!ok) return;
  }, [requireFreshAuth]);

  return [
    { id: "pause-all-agents",   label: "Pause all agents",          destructive: true, run: onPauseAll },
    { id: "run-auth-suite",     label: "Run suite auth-regression",                    destructive: false, run: onRunAuthRegression },
    { id: "page-on-call",       label: "Page on-call",              destructive: true, run: onPageOnCall },
  ];
}
