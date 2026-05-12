"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { DialogCloseButton } from "@/components/dialog-close-button";
import { cn } from "@/lib/utils";

/**
 * Three workspace-wide destructive actions:
 *   - Pause / Resume runtime         (toggles runtime.paused)
 *   - Reset preferences              (UPSERTs prefs to defaults)
 *   - Delete workspace               (TRUNCATEs every data table)
 *
 * Each action requires a fresh re-auth and is audit-logged server-side.
 * The Delete dialog additionally requires the operator to type the current
 * workspace name as confirmation — the server re-verifies, so this isn't
 * just UI theatre.
 */
export function DangerZone({ workspaceName }: { workspaceName: string }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();

  const runtimeState = trpc.runtime.state.useQuery(undefined, { staleTime: 5_000 });
  const pauseAll = trpc.runtime.pauseAll.useMutation({
    onSuccess: () => void utils.runtime.state.invalidate(),
  });
  const resetPrefs = trpc.settings.resetPreferences.useMutation({
    onSuccess: () => void utils.settings.overview.invalidate(),
  });

  const paused = runtimeState.data?.paused ?? false;
  const [showDelete, setShowDelete] = useState(false);

  async function onPauseToggle() {
    const next = !paused;
    const ok = await requireFreshAuth(
      next ? "Pause every agent in the workspace." : "Resume every agent in the workspace.",
    );
    if (!ok) return;
    pauseAll.mutate({ paused: next });
  }

  async function onResetPrefs() {
    const ok = await requireFreshAuth("Reset every preference to its default.");
    if (!ok) return;
    resetPrefs.mutate();
  }

  return (
    <article
      className="panel p-4"
      style={{ borderColor: "rgb(var(--bad) / 0.30)" }}
    >
      <h2 className="text-13 font-semibold text-bad mb-3 flex items-center gap-2">
        <AlertTriangle size={14} aria-hidden /> Danger zone
      </h2>

      <DangerRow
        title={paused ? "Resume all agents" : "Pause all agents"}
        subtitle={
          paused
            ? `Paused${runtimeState.data?.paused_by ? ` by ${runtimeState.data.paused_by}` : ""}${runtimeState.data?.paused_at ? ` · since ${new Date(runtimeState.data.paused_at).toLocaleString()}` : ""}.`
            : "Broadcasts a global pause via the agent runtime. Re-auth + audit-event."
        }
        action={paused ? "Resume" : "Pause"}
        icon={paused ? <Play size={11} aria-hidden /> : <Pause size={11} aria-hidden />}
        busy={pauseAll.isPending}
        error={pauseAll.error?.message ?? null}
        onClick={() => void onPauseToggle()}
        tone={paused ? "warn" : "warn"}
      />

      <DangerRow
        title="Reset preferences"
        subtitle="Drops every preference (theme, retention, timezone, density…) back to defaults. Audit-event."
        action="Reset"
        icon={<RotateCcw size={11} aria-hidden />}
        busy={resetPrefs.isPending}
        error={resetPrefs.error?.message ?? null}
        onClick={() => void onResetPrefs()}
        tone="warn"
      />

      <DangerRow
        title="Delete workspace"
        subtitle="Permanently truncates every data table. Type the workspace name + re-auth to confirm. The audit chain restarts after deletion."
        action="Delete…"
        icon={<Trash2 size={11} aria-hidden />}
        onClick={() => setShowDelete(true)}
        tone="bad"
      />

      {showDelete && (
        <DeleteWorkspaceDialog
          workspaceName={workspaceName}
          onClose={() => setShowDelete(false)}
        />
      )}
    </article>
  );
}

function DangerRow({
  title,
  subtitle,
  action,
  icon,
  busy,
  error,
  onClick,
  tone,
}: {
  title: string;
  subtitle: string;
  action: string;
  icon: React.ReactNode;
  busy?: boolean;
  error?: string | null;
  onClick: () => void;
  tone: "warn" | "bad";
}) {
  return (
    <div className="grid grid-cols-3 gap-3 py-3 border-t first:border-t-0 first:pt-0 items-center">
      <div className="col-span-2">
        <div className="text-12 text-fg">{title}</div>
        <div className="text-11 text-fg-muted">{subtitle}</div>
        {error && <div className="text-11 text-bad mt-1">{error}</div>}
      </div>
      <div className="text-right">
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          className={cn(
            "h-8 px-3 panel2 text-12 inline-flex items-center gap-1.5 disabled:opacity-50",
            tone === "bad" && "text-bad hover:border-bad/40",
            tone === "warn" && "text-warn hover:border-warn/40",
          )}
        >
          {busy ? <Loader2 size={11} className="animate-spin" aria-hidden /> : icon}
          {action}
        </button>
      </div>
    </div>
  );
}

function DeleteWorkspaceDialog({
  workspaceName,
  onClose,
}: {
  workspaceName: string;
  onClose: () => void;
}) {
  const { requireFreshAuth } = useReauthGate();
  const [confirm, setConfirm] = useState("");
  const wipe = trpc.settings.wipeWorkspace.useMutation({
    onSuccess: () => {
      // Hard reload — most cached client data is now stale (it referred to
      // tables we just emptied), and the UI gracefully degrades from a fresh
      // page load.
      window.location.href = "/";
    },
  });

  const matches = confirm.trim() === workspaceName;

  async function submit() {
    if (!matches) return;
    const ok = await requireFreshAuth(`Delete workspace "${workspaceName}". This wipes every data table.`);
    if (!ok) return;
    wipe.mutate({ confirm_name: confirm.trim() });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delete workspace"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden onClick={onClose} />
      <div className="relative panel w-full max-w-md p-5 animate-appear">
        <DialogCloseButton onClick={onClose} />
        <header className="mb-3 pr-8">
          <h3 className="text-13 font-semibold text-bad flex items-center gap-2">
            <AlertTriangle size={14} aria-hidden /> Delete workspace
          </h3>
        </header>

        <p className="text-12 text-fg-muted mb-3">
          This will <strong className="text-fg">permanently truncate</strong> every data table:
          sessions, approvals, audit events, infra, agents, evals, budgets, reports, webhooks,
          tokens, members, connections — everything. The audit chain restarts from empty.
        </p>
        <p className="text-12 text-fg-muted mb-3">
          You can re-bootstrap demo data afterwards with{" "}
          <span className="font-mono text-11 text-fg">pnpm db:seed</span>, but in-flight ingest data
          is unrecoverable.
        </p>

        <label className="block text-11 text-fg-muted mb-1">
          Type <span className="font-mono text-fg">{workspaceName}</span> to confirm
        </label>
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          className="w-full h-9 panel2 bg-transparent px-3 font-mono text-12 text-fg outline-none mb-1 focus:border-bad/60"
        />
        {confirm && !matches && (
          <p className="text-11 text-warn mb-2">Name doesn&apos;t match yet.</p>
        )}

        {wipe.error && (
          <p className="text-11 text-bad mt-2" title={wipe.error.message}>
            Delete failed — {wipe.error.message}
          </p>
        )}

        <footer className="flex items-center gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={wipe.isPending}
            className="h-8 px-3 panel2 text-12 text-fg-muted hover:text-fg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!matches || wipe.isPending}
            className="h-8 px-3 ml-auto panel2 hover:border-bad/40 text-12 text-bad flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {wipe.isPending ? <Loader2 size={11} className="animate-spin" aria-hidden /> : <Trash2 size={11} aria-hidden />}
            Delete workspace
          </button>
        </footer>
      </div>
    </div>
  );
}
