"use client";

import { Calendar, Download, FileText, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { KpiCard } from "@/components/kpi-card";
import { cn } from "@/lib/utils";

export function ReportsView({ initial }: { initial: RouterOutputs["reports"]["overview"] }) {
  const q = trpc.reports.overview.useQuery(undefined, { initialData: initial });
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
      </header>

      <section aria-label="Reports KPIs" className="grid grid-cols-4 gap-3">
        <KpiCard label="Scheduled" value={String(d.kpi.scheduled)} />
        <KpiCard label="Delivered · 30d" value={d.kpi.delivered_30d.toLocaleString()} tone="ok" />
        <KpiCard label="Ad-hoc exports" value={String(d.kpi.ad_hoc)} />
        <KpiCard label="Compliance bundles" value={String(d.kpi.bundles)} tone="violet" />
      </section>

      {/* Scheduled */}
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
              </tr>
            </thead>
            <tbody>
              {d.scheduled.map((r) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ad-hoc */}
      <section>
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Recent ad-hoc exports
        </h2>
        <div className="panel divide-y">
          {d.ad_hoc.map((r) => (
            <div key={r.id} className="px-3 py-2 flex items-center gap-3 text-12">
              <FileText size={12} className="text-fg-faint" aria-hidden />
              <span className="text-fg flex-1 truncate">{r.name}</span>
              <span className="text-fg-muted">{r.by}</span>
              <span className="font-mono text-11 text-fg-faint w-20 text-right">{r.size}</span>
              <span className="text-11 text-fg-faint w-24 text-right">{r.when}</span>
              <button type="button" className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg-muted hover:text-fg flex items-center gap-1">
                <Download size={11} aria-hidden /> Download
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance bundles */}
      <section>
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Compliance bundles
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {d.bundles.map((b) => (
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
                  disabled={b.status !== "ready"}
                  className="ml-auto h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Download size={12} aria-hidden /> Download
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
