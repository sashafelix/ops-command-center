"use client";

import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { StatusDot } from "@/components/status-dot";
import { cn } from "@/lib/utils";
import type { Connection } from "@/server/mock/seed";
import type { RouterOutputs } from "@/lib/trpc/types";
import { NOTIFICATION_EVENTS } from "@/lib/notification-events";

type WebhookView = RouterOutputs["settings"]["overview"]["webhooks"][number];

/**
 * Notifications surface — two halves:
 *
 *   1. Channels: connection rows in the "Notifications" category (Slack,
 *      PagerDuty, …). Just a read-only mirror of Settings → Connections,
 *      filtered. Real connector status, no hardcoded "Email · ses" card.
 *
 *   2. Routing matrix: grid of events × webhooks. Each checkbox toggles
 *      whether that webhook is subscribed to that event — mutating the
 *      webhook's `events` array via the existing saveWebhook mutation.
 *      No special "channel" abstraction; webhooks ARE the channels.
 *
 * Hardcoded `routedFor()` matrix is gone; the data lives in the DB now.
 */
export function NotificationsSection({
  connections,
  webhooks,
}: {
  connections: Connection[];
  webhooks: WebhookView[];
}) {
  const channels = connections.filter((c) => c.category === "Notifications");

  return (
    <article className="flex flex-col gap-4">
      <h2 className="text-13 font-semibold text-fg">Notifications</h2>

      <section>
        <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Channels
        </div>
        {channels.length === 0 ? (
          <div className="panel p-4 text-12 text-fg-muted">
            No notification connections configured. Add one under{" "}
            <span className="font-mono">Settings → Connections</span>.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {channels.map((c) => (
              <article key={c.id} className="panel p-3 flex flex-col gap-2">
                <header className="flex items-center gap-2">
                  <span className="text-13 text-fg flex-1 truncate">{c.name}</span>
                  <StatusDot tone={c.health} label={c.status} />
                </header>
                <div className="text-11 text-fg-muted truncate">{c.detail}</div>
                <div className="text-11 text-fg-faint">last sync · {c.last_sync}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Routing matrix
        </div>
        {webhooks.length === 0 ? (
          <div className="panel p-4 text-12 text-fg-muted">
            No webhooks yet. Add one under{" "}
            <span className="font-mono">Settings → Webhooks</span>.
          </div>
        ) : (
          <RoutingMatrix webhooks={webhooks} />
        )}
        <p className="text-11 text-fg-faint mt-2">
          Each checkbox writes through to the webhook&apos;s <span className="font-mono">events</span>{" "}
          array. <span className="font-mono">audit.row</span> is a catch-all that fires for every
          audit event.
        </p>
      </section>
    </article>
  );
}

// =============================================================================

function RoutingMatrix({ webhooks }: { webhooks: WebhookView[] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const save = trpc.settings.saveWebhook.useMutation({
    onSuccess: () => void utils.settings.overview.invalidate(),
  });

  async function toggle(webhook: WebhookView, event: string, on: boolean) {
    const ok = await requireFreshAuth(
      `${on ? "Subscribe" : "Unsubscribe"} ${webhook.id} ${on ? "to" : "from"} ${event}.`,
    );
    if (!ok) return;
    const current = new Set(webhook.events);
    if (on) current.add(event);
    else current.delete(event);
    save.mutate({ id: webhook.id, events: Array.from(current) });
  }

  // Track in-flight cell so we can show a spinner without blocking other clicks
  const pendingId = save.isPending ? save.variables?.id ?? null : null;

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-12">
        <thead>
          <tr className="border-b text-fg-faint font-mono text-[10.5px] tracking-widest uppercase">
            <th className="text-left px-3 py-2 font-normal sticky left-0 bg-[var(--surface-1)]">
              event
            </th>
            {webhooks.map((w) => (
              <th
                key={w.id}
                className="px-3 py-2 font-normal text-center align-bottom"
                title={w.url}
              >
                <div className="flex flex-col items-center gap-1">
                  <StatusDot tone={w.status} label={w.id} />
                  <span className="text-fg font-mono text-11 normal-case max-w-[10rem] truncate">
                    {w.id}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_EVENTS.map((event) => (
            <tr key={event} className="border-t">
              <td className="px-3 py-2 font-mono text-fg sticky left-0 bg-[var(--surface-1)]">
                {event}
              </td>
              {webhooks.map((w) => {
                const subscribed = w.events.includes(event);
                const cellPending = pendingId === w.id;
                return (
                  <td key={w.id} className="px-3 py-2 text-center">
                    <label
                      className={cn(
                        "inline-flex items-center justify-center cursor-pointer w-6 h-6",
                        cellPending && "opacity-50 cursor-wait",
                      )}
                    >
                      {cellPending ? (
                        <Loader2 size={11} className="animate-spin text-fg-faint" aria-hidden />
                      ) : (
                        <input
                          type="checkbox"
                          checked={subscribed}
                          onChange={(e) => void toggle(w, event, e.target.checked)}
                          className="accent-info"
                          aria-label={`${w.id} subscribed to ${event}`}
                        />
                      )}
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
