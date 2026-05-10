"use client";

import { trpc } from "@/lib/trpc/client";
import { StatusDot } from "@/components/status-dot";
import { Cpu, GitBranch, Clock, DollarSign, Terminal, Hash, Copy, ExternalLink } from "lucide-react";
import { fmtDur, fmtUSD } from "@/lib/utils";

export function ReceiptView({ id }: { id: string }) {
  const q = trpc.sessions.detail.useQuery({ id });

  if (q.isLoading) {
    return (
      <div className="p-6 flex flex-col gap-3">
        <div className="h-8 panel skel" aria-hidden />
        <div className="h-32 panel skel" aria-hidden />
        <div className="h-64 panel skel" aria-hidden />
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <div className="p-6">
        <span className="chip bad">Could not load session — {q.error?.message ?? "unknown error"}</span>
      </div>
    );
  }

  const r = q.data;
  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <StatusDot tone="ok" label={r.id} />
              <span className="font-mono text-11 text-fg-muted uppercase tracking-widest">{r.outcome}</span>
            </div>
            <h2 className="text-13 font-semibold text-fg truncate">{r.goal}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="chip"><Cpu size={11} aria-hidden />{r.agent}</span>
              <span className="chip">{r.model}</span>
              <span className="chip"><GitBranch size={11} aria-hidden />{r.repo}</span>
              <span className="chip">branch · {r.branch}</span>
              <span className="chip">op · {r.operator}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" className="h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5">
              <Copy size={12} aria-hidden /> Copy id
            </button>
            <a href={`/sessions/${r.id}`} className="h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5">
              <ExternalLink size={12} aria-hidden /> Full page
            </a>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-6 gap-3 mt-4">
          <Metric label="Runtime" icon={<Clock size={11} className="text-fg-dim" aria-hidden />} value={fmtDur(r.runtime_s)} />
          <Metric label="Cost" icon={<DollarSign size={11} className="text-fg-dim" aria-hidden />} value={fmtUSD(r.cost_usd)} />
          <Metric label="Tools" icon={<Terminal size={11} className="text-fg-dim" aria-hidden />} value={r.tools.toString()} />
          <Metric label="Tokens in" value={r.tokens_in.toLocaleString()} />
          <Metric label="Tokens out" value={r.tokens_out.toLocaleString()} />
          <Metric label="Trust" value={r.trust_score.toFixed(2)} />
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4 px-6 py-4">
        {/* Timeline */}
        <section className="col-span-8">
          <h3 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-2">Timeline</h3>
          <ol className="panel divide-y">
            {r.timeline.map((step, i) => (
              <li
                key={`${step.t}-${i}`}
                className={`flex items-center gap-3 px-3 py-2 ${step.current ? "bg-[var(--hover)]" : ""}`}
              >
                <span className="font-mono text-11 text-fg-faint num w-12 shrink-0">{step.t}</span>
                <span className="font-mono text-11 text-fg-muted w-20 shrink-0 truncate">{step.kind}</span>
                <span className="text-12 text-fg flex-1 truncate">{step.name}</span>
                <span className="text-11 text-fg-muted truncate hidden md:inline max-w-[40%]">{step.note}</span>
                <span className="font-mono text-11 text-fg-muted w-16 text-right num">
                  {step.cost_usd > 0 ? fmtUSD(step.cost_usd) : "—"}
                </span>
                <span className="font-mono text-11 text-fg-faint w-14 text-right num">{step.latency_ms}ms</span>
              </li>
            ))}
          </ol>

          {/* Artifacts */}
          <h3 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mt-4 mb-2">Artifacts</h3>
          <ul className="panel divide-y">
            {r.artifacts.map((a) => (
              <li key={a.name} className="flex items-center gap-3 px-3 py-2">
                <Hash size={11} className="text-fg-faint" aria-hidden />
                <span className="text-12 text-fg flex-1 truncate">{a.name}</span>
                <span className="font-mono text-11 text-fg-muted">{a.delta}</span>
                <span className="font-mono text-11 text-fg-faint w-20 text-right">{a.bytes}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Signals + DVR slot */}
        <aside className="col-span-4 flex flex-col gap-3">
          <h3 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint">Signals</h3>
          {r.signals.map((sig) => (
            <div key={sig.label} className="panel p-3">
              <div className="flex items-center justify-between">
                <span className="text-12 text-fg-muted">{sig.label}</span>
                <span
                  className={`font-mono text-11 num ${sig.tone === "warn" ? "text-warn" : sig.tone === "bad" ? "text-bad" : "text-ok"}`}
                >
                  {sig.value}
                </span>
              </div>
              <p className="text-11 text-fg-faint mt-1">{sig.note}</p>
            </div>
          ))}

          {/* DVR placeholder per HANDOFF §9 — slot exists, no playback in v1 */}
          <div className="panel p-3 mt-2">
            <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-2">
              DVR scrubber
            </div>
            <div className="text-11 text-fg-muted">Playback not in v1.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="panel2 p-2.5 flex flex-col gap-1">
      <span className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint">{label}</span>
      <span className="text-fg text-13 font-semibold flex items-center gap-1.5 num">
        {icon}
        {value}
      </span>
    </div>
  );
}
