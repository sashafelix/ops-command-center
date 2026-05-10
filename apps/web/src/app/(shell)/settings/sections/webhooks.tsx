"use client";

import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { StatusDot } from "@/components/status-dot";
import type { WebhookRow } from "@/server/mock/seed";

export function WebhooksSection({ items }: { items: WebhookRow[] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const toggle = trpc.settings.toggleWebhook.useMutation({
    onSuccess: () => void utils.settings.overview.invalidate(),
  });

  async function onToggle(id: string, enabled: boolean) {
    const ok = await requireFreshAuth(`Toggle webhook ${id} → ${enabled ? "enabled" : "paused"}.`);
    if (!ok) return;
    toggle.mutate({ id, enabled });
  }

  return (
    <article>
      <h2 className="text-13 font-semibold text-fg mb-3">Webhooks</h2>
      <div className="panel divide-y">
        {items.map((w) => (
          <div key={w.id} className="px-3 py-2 flex items-center gap-3">
            <StatusDot tone={w.status} label={w.id} />
            <span className="font-mono text-11 text-fg flex-1 truncate">{w.url}</span>
            <div className="flex items-center gap-1 flex-wrap">
              {w.events.map((e) => (
                <span key={e} className="chip">{e}</span>
              ))}
            </div>
            <span className="font-mono text-11 text-fg-faint w-44 text-right">{w.delivery_stats}</span>
            <button
              type="button"
              onClick={() => void onToggle(w.id, w.status !== "ok")}
              className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg-muted hover:text-fg"
            >
              {w.status === "ok" ? "Pause" : "Resume"}
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}
