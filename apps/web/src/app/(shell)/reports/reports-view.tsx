"use client";

import { useState } from "react";
import { Calendar, Download, FileText, Loader2, Play, Plus, RotateCw, ShieldCheck, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { KpiCard } from "@/components/kpi-card";
import { DialogCloseButton } from "@/components/dialog-close-button";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { cn } from "@/lib/utils";

type Format = "PDF" | "CSV" | "JSONL";

export function ReportsView({ initial }: { initial: RouterOutputs["reports"]["overview"] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const q = trpc.reports.overview.useQuery(undefined, { initialData: initial });

  const runScheduled = trpc.reports.runScheduled.useMutation({
    onSuccess: () => void utils.reports.overview.invalidate(),
  });
  const runAdHoc = trpc.reports.runAdHoc.useMutation({
    onSuccess: () => void utils.reports.overview.invalidate(),
  });
  const buildBundle = trpc.reports.buildBundle.useMutation({
    onSuccess: () => void utils.reports.overview.invalidate(),
  });

  const [adHocOpen, setAdHocOpen] = useState(false);

  async function onRunScheduled(id: string, name: string) {
    const ok = await requireFreshAuth(`Run scheduled report ${name} now.`);
    if (!ok) return;
    runScheduled.mutate({ id });
  }

  async function onBuildBundle(id: string, name: string) {
    const ok = await requireFreshAuth(`Rebuild compliance bundle ${name}.`);
    if (!ok) return;
    buildBundle.mutate({ id });
  }

  if (q.isLoading || !q.data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 panel skel" aria-hidden />
          ))}
        </div>
        <div className="h-64 panel skel" aria-hidden />
      </div>
    );
  }

  const d = q.data;
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-fg text-13 font-semibold tracking-tight">Reports</h1>
          <p className="text-12 text-fg-muted mt-1">
            Scheduled reports, ad-hoc exports, compliance bundles. Each compliance bundle is
            deterministic over its date range — same range → same bytes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdHocOpen(true)}
          className="h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5"
        >
          <Plus size={12} aria-hidden /> New ad-hoc
        </button>
      </header>

      <section aria-label="Reports KPIs" className="grid grid-cols-4 gap-3">
        <KpiCard label="Scheduled" value={String(d.kpi.scheduled)} />
        <KpiCard label="Delivered · 30d" value={d.kpi.delivered_30d.toLocaleString()} tone="ok" />
        <KpiCard label="Ad-hoc exports" value={String(d.kpi.ad_hoc)} />
        <KpiCard label="Compliance bundles" value={String(d.kpi.bundles)} tone="violet" />
      </section>

      <section>
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Scheduled reports
        </h2>
        <div className="panel overflow-hidden">
          <table className="w-full text-12">
            <thead className="text-fg-faint">
              <tr className="font-mono text-[10.5px] tracking-widest uppercase">
                <th className="text-left px-3 py-2 font-normal">Name</th>
                <th className="text-left px-3 py-2 font-normal w-44">Cadence</th>
                <th className="text-left px-3 py-2 font-normal w-44">Next run</th>
                <th className="text-left px-3 py-2 font-normal">Recipients</th>
                <th className="text-left px-3 py-2 font-normal w-20">Format</th>
                <th className="text-right px-3 py-2 font-normal w-28">Last</th>
                <th className="px-3 py-2 font-normal w-24" />
              </tr>
            </thead>
            <tbody>
              {d.scheduled.map((r) => {
                const busy = runScheduled.isPending && runScheduled.variables?.id === r.id;
                return (
                  <tr key={r.id} className="border-t hover:bg-[var(--hover-soft)]">
                    <td className="px-3 py-2 text-fg flex items-center gap-2">
                      <FileText size={12} className="text-fg-faint" aria-hidden />
                      {r.name}
                    </td>
                    <td className="px-3 py-2">
                      <span className="chip">
                        <Calendar size={11} aria-hidden /> {r.cadence}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-fg-muted">{r.next_run}</td>
                    <td className="px-3 py-2 text-fg-muted">
                      <div className="flex flex-wrap items-center gap-1">
                        {r.recipients.map((rcp) => (
                          <span key={rcp} className="chip">
                            {rcp}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="chip">{r.format}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-11 text-fg-faint">{r.last_run}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void onRunScheduled(r.id, r.name)}
                        disabled={busy}
                        title="Run this scheduled report now"
                        className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg-muted hover:text-fg inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 size={11} className="animate-spin" aria-hidden />
                        ) : (
                          <Play size={11} aria-hidden />
                        )}
                        Run now
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Recent ad-hoc exports
        </h2>
        <div className="panel divide-y">
          {d.ad_hoc.length === 0 ? (
            <div className="px-3 py-4 text-12 text-fg-muted">
              No ad-hoc reports yet. Click <span className="font-mono">New ad-hoc</span> above to
              record a request.
            </div>
          ) : (
            d.ad_hoc.map((r) => (
              <div key={r.id} className="px-3 py-2 flex items-center gap-3 text-12">
                <FileText size={12} className="text-fg-faint" aria-hidden />
                <span className="text-fg flex-1 truncate">{r.name}</span>
                <span className="text-fg-muted">{r.by}</span>
                <span className="font-mono text-11 text-fg-faint w-20 text-right">{r.size}</span>
                <span className="text-11 text-fg-faint w-24 text-right">{r.when}</span>
                <button
                  type="button"
                  disabled
                  title="Real content generation lands in a follow-up PR"
                  className="h-7 px-2 panel2 text-11 text-fg-faint opacity-40 cursor-not-allowed inline-flex items-center gap-1"
                >
                  <Download size={11} aria-hidden /> Download
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Compliance bundles
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {d.bundles.map((b) => {
            const busy = buildBundle.isPending && buildBundle.variables?.id === b.id;
            return (
              <article key={b.id} className="panel p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-violet" aria-hidden />
                  <h3 className="text-13 text-fg font-semibold">{b.name}</h3>
                </div>
                <div className="text-12 text-fg-muted">{b.framework}</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1 font-mono text-11 text-fg-muted">
                  <div className="text-fg-dim">Range</div>
                  <div className="text-fg num text-right">{b.range}</div>
                  <div className="text-fg-dim">Last built</div>
                  <div className="text-fg-muted text-right">{b.last_built}</div>
                  <div className="text-fg-dim">Content hash</div>
                  <div className="text-fg-faint text-right truncate">{b.content_hash}</div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={cn(
                      "chip",
                      b.status === "ready" && "ok",
                      b.status === "stale" && "warn",
                      b.status === "building" && "info",
                    )}
                  >
                    {b.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => void onBuildBundle(b.id, b.name)}
                    disabled={busy}
                    title="Rebuild — sets status to ready, stamps last_built to now"
                    className="ml-auto h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 size={12} className="animate-spin" aria-hidden />
                    ) : (
                      <RotateCw size={12} aria-hidden />
                    )}
                    Rebuild
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {adHocOpen && (
        <NewAdHocDialog
          onClose={() => setAdHocOpen(false)}
          onSubmit={async (name, format) => {
            const ok = await requireFreshAuth(`Create ad-hoc report ${name}.`);
            if (!ok) return;
            runAdHoc.mutate({ name, format }, { onSuccess: () => setAdHocOpen(false) });
          }}
          busy={runAdHoc.isPending}
          error={runAdHoc.error?.message ?? null}
        />
      )}
    </div>
  );
}

function NewAdHocDialog({
  onClose,
  onSubmit,
  busy,
  error,
}: {
  onClose: () => void;
  onSubmit: (name: string, format: Format) => void;
  busy: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("JSONL");
  const valid = name.trim().length > 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New ad-hoc report"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden onClick={onClose} />
      <div className="relative panel w-full max-w-md p-5 animate-appear">
        <DialogCloseButton onClick={onClose} />
        <header className="mb-3 pr-8">
          <h3 className="text-13 font-semibold text-fg">New ad-hoc report</h3>
          <p className="text-11 text-fg-muted mt-1">
            Records the request. Real content generation lands in a follow-up PR.
          </p>
        </header>

        <label className="block text-11 text-fg-muted mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. October audit chain"
          autoFocus
          className="w-full h-8 panel2 bg-transparent px-2 text-12 text-fg outline-none focus:border-line2 mb-3"
        />

        <label className="block text-11 text-fg-muted mb-1">Format</label>
        <div className="flex items-center gap-2 mb-3">
          {(["PDF", "CSV", "JSONL"] as Format[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={cn(
                "h-8 px-3 panel2 text-12",
                format === f ? "text-fg border-line2" : "text-fg-muted hover:text-fg",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {error && <p className="text-11 text-bad mb-2">{error}</p>}

        <footer className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-8 px-3 text-12 text-fg-muted hover:text-fg disabled:opacity-50"
          >
            <X size={12} className="inline -mt-px" aria-hidden /> Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(name.trim(), format)}
            disabled={!valid || busy}
            className="h-8 px-3 panel2 hover:border-line2 text-12 text-fg flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Plus size={12} aria-hidden />}
            Create
          </button>
        </footer>
      </div>
    </div>
  );
}
