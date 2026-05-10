"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { StatusDot } from "@/components/status-dot";
import { Heatmap, type HeatmapRow } from "@/components/heatmap";
import { cn } from "@/lib/utils";

type Mode = "internal" | "public";

export function StatusPageView() {
  const [mode, setMode] = useState<Mode>("internal");
  const q = trpc.statusPage.overview.useQuery({ mode });

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
          <span className={cn("chip", d.published ? "ok" : "warn")}>
            {d.published ? "published" : "draft"}
          </span>
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
            <Heatmap rows={uptimeRows} cellSize={6} gap={1} ariaLabel="90 day uptime by public signal" />
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
