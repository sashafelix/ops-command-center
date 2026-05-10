"use client";

import { Pause, Play } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";

/**
 * Sits between the top bar and NOW PLAYING. Visible only while the workspace
 * runtime is paused. Surfaces who paused + when, plus an admin-only Resume.
 */
export function RuntimeBanner() {
  const utils = trpc.useUtils();
  const q = trpc.runtime.state.useQuery(undefined, { staleTime: 30_000 });
  const { requireFreshAuth } = useReauthGate();
  const m = trpc.runtime.pauseAll.useMutation({
    onSuccess: () => void utils.runtime.state.invalidate(),
  });

  if (!q.data?.paused) return null;

  const onResume = async () => {
    const ok = await requireFreshAuth("Confirm to resume all agents.");
    if (!ok) return;
    m.mutate({ paused: false });
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b bg-bad/10 px-4 py-2 flex items-center gap-3 text-12 text-fg"
    >
      <Pause size={14} className="text-bad" aria-hidden />
      <span className="text-bad font-mono uppercase tracking-widest text-[10.5px]">
        Workspace paused
      </span>
      <span className="text-fg-muted">
        by <span className="text-fg">{q.data.paused_by ?? "—"}</span>
        {q.data.paused_at && <> · since <span className="font-mono">{q.data.paused_at}</span></>}
      </span>
      <button
        type="button"
        onClick={() => void onResume()}
        disabled={m.isPending}
        className="ml-auto h-7 px-2 panel2 hover:border-line2 text-11 text-fg flex items-center gap-1.5"
      >
        <Play size={11} aria-hidden /> Resume
      </button>
    </div>
  );
}
