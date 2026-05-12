"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { StatusDot } from "@/components/status-dot";
import { Heatmap, type HeatmapRow } from "@/components/heatmap";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { cn } from "@/lib/utils";

type Mode = "internal" | "public";
const INCIDENT_STATES = ["investigating", "monitoring", "resolved"] as const;

export function StatusPageView({ initial }: { initial: RouterOutputs["statusPage"]["overview"] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const [mode, setMode] = useState<Mode>("internal");
  const q = trpc.statusPage.overview.useQuery(
    { mode },
    mode === "internal" ? { initialData: initial } : {},
  );

  const setPublished = trpc.statusPage.setPublished.useMutation({
    onSuccess: () => void utils.statusPage.overview.invalidate(),
  });
  const setIncidentState = trpc.statusPage.setIncidentState.useMutation({
    onSuccess: () => void utils.statusPage.overview.invalidate(),
  });

  async function onTogglePublished(next: boolean) {
    const ok = await requireFreshAuth(
      next ? "Publish the status page." : "Unpublish the status page (set to draft).",
    );
    if (!ok) return;
    setPublished.mutate({ published: next });
  }

  async function onSetIncidentState(id: string, state: (typeof INCIDENT_STATES)[number]) {
    const ok = await requireFreshAuth(`Move incident ${id} → ${state}.`);
    if (!ok) return;
    setIncidentState.mutate({ id, state });
  }

  if (q.isLoading || !q.data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-12 panel skel" aria-hidden />
        <div className="h-64 panel skel" aria-hidden />
      </div>
    );
  }

  const d = q.data;
  const uptimeRows: HeatmapRow[] = d.publicSignals.map((s) => ({
    label: s.name,
    values: s.uptime90,
    summary: s.uptime,
  }));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-fg text-13 font-semibold tracking-tight">Status page</h1>
          <p className="text-12 text-fg-muted mt-1">
            Public + private signals. The public mode preview renders from the same data with the
            internal-only signals hidden — the same components, public flag flipped.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-11 text-fg-faint">{d.url}</span>
          <button
            type="button"
            onClick={() => void onTogglePublished(!d.published)}
            disabled={setPublished.isPending}
            title={d.published ? "Unpublish (set to draft)" : "Publish"}
            className={cn(
              "chip cursor-pointer hover:border-line2 disabled:opacity-60 disabled:cursor-wait",
              d.published ? "ok" : "warn",
            )}
          >
            {setPublished.isPending ? (
              <Loader2 size={10} className="animate-spin mr-1" aria-hidden />
            ) : null}
            {d.published ? "published" : "draft"}
          </button>
          <div className="flex items-center gap-1 panel2 p-0.5">
            <ModeButton current={mode} mode="internal" onClick={() => setMode("internal")} />
            <ModeButton current={mode} mode="public" onClick={() => setMode("public")} />
          </div>
        </div>
      </header>

      <section className="grid grid-cols-12 gap-3">
        {/* Public signals */}
        <div className="col-span-7 flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1">
            Public signals
          </h2>
          <div className="panel divide-y">
            {d.publicSignals.map((s) => (
              <div key={s.id} className="px-3 py-2 flex items-center gap-3">
                <StatusDot tone={s.state} label={s.name} />
                <span className="ml-auto font-mono text-11 text-fg num">{s.uptime}</span>
                <span className="text-11 text-fg-muted w-32 text-right truncate">last · {s.last_incident}</span>
              </div>
            ))}
          </div>

          <h3 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mt-2 px-1">
            90-day uptime
          </h3>
          <div className="panel p-4">
            <Heatmap
              rows={uptimeRows}
              mode="uptime"
              cellSize={6}
              gap={1}
              ariaLabel="90 day uptime by public signal"
            />
          </div>
        </div>

        {/* Private signals */}
        <div className="col-span-5 flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1">
            Internal only {mode === "public" && <span className="text-fg-faint">· hidden in public mode</span>}
          </h2>
          {mode === "public" ? (
            <div className="panel p-4 text-12 text-fg-muted">
              Internal signals are not visible in the public preview.
            </div>
          ) : d.privateSignals.length === 0 ? (
            <div className="panel p-4 text-12 text-fg-muted">No internal signals.</div>
          ) : (
            <div className="panel divide-y">
              {d.privateSignals.map((s) => (
                <div key={s.id} className="px-3 py-2 flex items-center gap-3">
                  <StatusDot tone={s.state} label={s.name} />
                  <span className="text-11 text-fg-muted ml-auto truncate max-w-[60%] text-right">{s.note}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent incidents */}
      <section>
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Recent incidents
        </h2>
        {d.incidents.length === 0 ? (
          <div className="panel p-4 text-12 text-fg-muted">No incidents in this view.</div>
        ) : (
          <div className="panel divide-y">
            {d.incidents.map((i) => (
              <div key={i.id} className="px-3 py-2 flex items-center gap-3">
                <StatusDot tone={i.state === "resolved" ? "ok" : i.state === "monitoring" ? "info" : "warn"} label={i.id} />
                <span className="text-12 text-fg flex-1 truncate">{i.title}</span>
                <span className="font-mono text-11 text-fg-muted">{i.started_at}</span>
                <span className="font-mono text-11 text-fg-faint num">{i.updates} updates</span>
                <span className={cn("chip", i.public ? "info" : "warn")}>{i.public ? "public" : "internal"}</span>
                <div className="flex items-center gap-1">
                  {INCIDENT_STATES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void onSetIncidentState(i.id, s)}
                      disabled={
                        i.state === s ||
                        (setIncidentState.isPending && setIncidentState.variables?.id === i.id)
                      }
                      title={`Set state to ${s}`}
                      className={cn(
                        "chip cursor-pointer hover:border-line2",
                        i.state === s && s === "resolved" && "ok",
                        i.state === s && s === "monitoring" && "info",
                        i.state === s && s === "investigating" && "warn",
                        i.state !== s && "text-fg-faint",
                        "disabled:cursor-default",
                      )}
                    >
                      {setIncidentState.isPending &&
                      setIncidentState.variables?.id === i.id &&
                      setIncidentState.variables?.state === s ? (
                        <Loader2 size={10} className="animate-spin" aria-hidden />
                      ) : null}
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ModeButton({
  current,
  mode,
  onClick,
}: {
  current: Mode;
  mode: Mode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-2 text-12 rounded",
        current === mode
          ? "bg-[var(--hover)] text-fg"
          : "text-fg-muted hover:text-fg",
      )}
      aria-pressed={current === mode}
    >
      {mode}
    </button>
  );
}
