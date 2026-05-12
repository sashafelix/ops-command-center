"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Check, ChevronRight, RotateCcw, Loader2 } from "lucide-react";
import { DialogCloseButton } from "@/components/dialog-close-button";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { StatusDot } from "@/components/status-dot";
import type { RouterOutputs } from "@/lib/trpc/types";
import { cn } from "@/lib/utils";

type WebhookView = RouterOutputs["settings"]["overview"]["webhooks"][number];

// Real audit actions emitted by the codebase today, plus the audit.row
// wildcard for "everything." Anything not in this list either doesn't
// emit yet (no event source) or is too noisy to surface here.
const EVENT_OPTIONS = [
  "audit.row", //              catch-all: every audit event
  "approval.approve",
  "approval.deny",
  "agent.rollback",
  "evals.run",
  "connection.test.fail",
  "connection.test.ok",
  "connection.create",
  "connection.delete",
  "token.create",
  "token.revoke",
  "member.invite",
  "runtime.pause-all", //      kill switch fired
] as const;

export function WebhooksSection({ items }: { items: WebhookView[] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftEvents, setDraftEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = trpc.settings.toggleWebhook.useMutation({
    onSuccess: () => void utils.settings.overview.invalidate(),
  });
  const save = trpc.settings.saveWebhook.useMutation({
    onSuccess: () => {
      setEditingId(null);
      void utils.settings.overview.invalidate();
    },
  });
  const remove = trpc.settings.deleteWebhook.useMutation({
    onSuccess: () => void utils.settings.overview.invalidate(),
  });
  const create = trpc.settings.createWebhook.useMutation({
    onSuccess: () => {
      setCreating(false);
      setNewUrl("");
      setNewEvents([]);
      void utils.settings.overview.invalidate();
    },
  });

  function startEdit(w: WebhookView) {
    setEditingId(w.id);
    setDraftUrl(w.url);
    setDraftEvents([...w.events]);
  }

  async function commitEdit(id: string) {
    const ok = await requireFreshAuth(`Update webhook ${id}.`);
    if (!ok) return;
    save.mutate({ id, url: draftUrl, events: draftEvents });
  }

  async function onToggle(id: string, enabled: boolean) {
    const ok = await requireFreshAuth(
      `Webhook ${id} → ${enabled ? "enabled" : "paused"}.`,
    );
    if (!ok) return;
    toggle.mutate({ id, enabled });
  }

  async function onRemove(id: string, url: string) {
    const ok = await requireFreshAuth(`Delete webhook ${url}. This cannot be undone.`);
    if (!ok) return;
    remove.mutate({ id });
  }

  async function onCreate() {
    const ok = await requireFreshAuth(`Create webhook → ${newUrl}.`);
    if (!ok) return;
    create.mutate({ url: newUrl, events: newEvents });
  }

  return (
    <article>
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-13 font-semibold text-fg">Webhooks</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5"
        >
          <Plus size={12} aria-hidden /> New webhook
        </button>
      </header>

      <div className="panel divide-y">
        {items.map((w) =>
          editingId === w.id ? (
            <EditRow
              key={w.id}
              draftUrl={draftUrl}
              draftEvents={draftEvents}
              onUrlChange={setDraftUrl}
              onEventsChange={setDraftEvents}
              onCancel={() => setEditingId(null)}
              onCommit={() => void commitEdit(w.id)}
              busy={save.isPending}
            />
          ) : (
            <div key={w.id}>
              <div className="px-3 py-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                  aria-label={expandedId === w.id ? "Collapse deliveries" : "Show recent deliveries"}
                  className="h-7 w-7 flex items-center justify-center text-fg-faint hover:text-fg"
                >
                  <ChevronRight
                    size={12}
                    aria-hidden
                    className={cn("transition-transform", expandedId === w.id && "rotate-90")}
                  />
                </button>
                <StatusDot tone={w.status} label={w.id} />
                <span className="font-mono text-11 text-fg flex-1 truncate">{w.url}</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {w.events.map((e) => (
                    <span key={e} className="chip">
                      {e}
                    </span>
                  ))}
                </div>
                <span
                  className="font-mono text-11 text-fg-faint w-44 text-right truncate"
                  title={w.last_delivery_at ? `last · ${w.last_delivery_at}` : "no deliveries yet"}
                >
                  {w.delivery_stats}
                </span>
                <button
                  type="button"
                  onClick={() => void onToggle(w.id, w.status !== "ok")}
                  className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg-muted hover:text-fg"
                >
                  {w.status === "ok" ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(w)}
                  className="h-7 w-7 flex items-center justify-center text-fg-muted hover:text-fg"
                  aria-label="Edit"
                >
                  <Pencil size={11} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void onRemove(w.id, w.url)}
                  className="h-7 w-7 flex items-center justify-center text-fg-faint hover:text-bad"
                  aria-label="Delete"
                >
                  <Trash2 size={11} aria-hidden />
                </button>
              </div>
              {expandedId === w.id && <DeliveriesPanel webhookId={w.id} />}
            </div>
          ),
        )}
      </div>

      {creating && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New webhook"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            aria-hidden
            onClick={() => setCreating(false)}
          />
          <div className="relative panel w-full max-w-md p-5 animate-appear">
            <DialogCloseButton onClick={() => setCreating(false)} />
            <header className="mb-3 pr-8">
              <h3 className="text-13 font-semibold text-fg">New webhook</h3>
            </header>

            <label className="block text-11 text-fg-muted mb-1">URL</label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://hooks.example.com/…"
              className="w-full h-9 panel2 bg-transparent px-3 text-12 text-fg outline-none mb-3"
            />
            <div className="text-11 text-fg-muted mb-1">Events</div>
            <EventCheckboxes selected={newEvents} onChange={setNewEvents} />

            <footer className="flex items-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="h-8 px-3 panel2 text-12 text-fg-muted hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onCreate()}
                disabled={
                  create.isPending || !/^https?:\/\//.test(newUrl) || newEvents.length === 0
                }
                className="h-8 px-3 ml-auto panel2 hover:border-line2 text-12 text-fg disabled:opacity-50"
              >
                Create
              </button>
            </footer>
            {create.error && (
              <p className="text-11 text-bad mt-2">Create failed — {create.error.message}</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function EditRow({
  draftUrl,
  draftEvents,
  onUrlChange,
  onEventsChange,
  onCancel,
  onCommit,
  busy,
}: {
  draftUrl: string;
  draftEvents: string[];
  onUrlChange: (s: string) => void;
  onEventsChange: (s: string[]) => void;
  onCancel: () => void;
  onCommit: () => void;
  busy: boolean;
}) {
  return (
    <div className="px-3 py-3 flex flex-col gap-2">
      <input
        type="url"
        value={draftUrl}
        onChange={(e) => onUrlChange(e.target.value)}
        className="w-full h-8 panel2 bg-transparent px-2 font-mono text-11 text-fg outline-none"
      />
      <EventCheckboxes selected={draftEvents} onChange={onEventsChange} />
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-7 px-2 text-11 text-fg-muted hover:text-fg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onCommit}
          disabled={busy}
          className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg flex items-center gap-1.5 disabled:opacity-50"
        >
          <Check size={11} aria-hidden /> Save
        </button>
      </div>
    </div>
  );
}

function EventCheckboxes({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (s: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
      {EVENT_OPTIONS.map((e) => {
        const on = selected.includes(e);
        return (
          <label key={e} className="flex items-center gap-2 text-11 text-fg cursor-pointer">
            <input
              type="checkbox"
              checked={on}
              onChange={(ev) =>
                onChange(
                  ev.target.checked
                    ? Array.from(new Set([...selected, e]))
                    : selected.filter((x) => x !== e),
                )
              }
              className="accent-info"
            />
            <span className="font-mono">{e}</span>
          </label>
        );
      })}
    </div>
  );
}

// =============================================================================
// Per-webhook deliveries panel — last N attempts, with redeliver
// =============================================================================

function DeliveriesPanel({ webhookId }: { webhookId: string }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const q = trpc.settings.webhookDeliveries.useQuery({ webhook_id: webhookId, limit: 20 });
  const redeliver = trpc.settings.redeliverWebhook.useMutation({
    onSuccess: () => {
      void q.refetch();
      void utils.settings.overview.invalidate();
    },
  });

  async function onRedeliver(deliveryId: string) {
    const ok = await requireFreshAuth(`Re-queue delivery ${deliveryId}.`);
    if (!ok) return;
    redeliver.mutate({ delivery_id: deliveryId });
  }

  if (q.isLoading) {
    return (
      <div className="px-3 pb-2 pt-1 text-11 text-fg-faint flex items-center gap-2">
        <Loader2 size={11} className="animate-spin" aria-hidden /> loading deliveries…
      </div>
    );
  }

  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="px-3 pb-2 pt-1 text-11 text-fg-faint">
        No delivery attempts yet. Once an event fires, attempts will appear here.
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 pt-1 border-t bg-[var(--bg-1)]">
      <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-2">
        Recent deliveries
      </div>
      <ul className="flex flex-col gap-1">
        {rows.map((d) => (
          <li key={d.id} className="grid grid-cols-12 gap-2 items-center text-11">
            <span
              className={cn(
                "col-span-1 font-mono",
                d.status === "delivered" && "text-ok",
                d.status === "dead" && "text-bad",
                d.status === "pending" && "text-warn",
              )}
            >
              {d.status === "delivered" ? "✓" : d.status === "dead" ? "✗" : "•"}{" "}
              {d.status}
            </span>
            <span className="col-span-2 font-mono text-fg-muted truncate" title={d.event_action}>
              {d.event_action}
            </span>
            <span className="col-span-1 font-mono text-fg-faint text-right">
              {d.http_status ?? "—"}
            </span>
            <span className="col-span-1 font-mono text-fg-faint text-right">
              {d.attempts}/5
            </span>
            <span className="col-span-4 font-mono text-fg-faint truncate" title={d.error ?? ""}>
              {d.error ?? ""}
            </span>
            <span className="col-span-2 font-mono text-fg-faint text-right" title={d.created_at}>
              {relTime(d.created_at)}
            </span>
            <span className="col-span-1 text-right">
              {(d.status === "dead" || d.status === "delivered") && (
                <button
                  type="button"
                  onClick={() => void onRedeliver(d.id)}
                  aria-label="Re-queue delivery"
                  title="Re-queue for another attempt"
                  className="h-6 w-6 inline-flex items-center justify-center text-fg-faint hover:text-fg"
                >
                  <RotateCcw size={11} aria-hidden />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function relTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
