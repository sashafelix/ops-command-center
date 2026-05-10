"use client";

import Link from "next/link";
import { Signature, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { KpiCard } from "@/components/kpi-card";
import { StatusDot } from "@/components/status-dot";
import { Heatmap, type HeatmapRow } from "@/components/heatmap";
import { cn } from "@/lib/utils";

export function TrustView() {
  const q = trpc.trust.overview.useQuery();

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
  const heat: HeatmapRow[] = d.threats.map((t) => ({
    label: t.category,
    values: t.values,
    summary: `Σ ${t.total}`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-fg text-13 font-semibold tracking-tight">Trust</h1>
          <p className="text-12 text-fg-muted mt-1">
            Threat heatmap, investigations, signed evidence stream.
          </p>
        </div>
      </header>

      <section aria-label="Trust KPIs" className="grid grid-cols-4 gap-3">
        <KpiCard label="Active threats" value={String(d.kpi.active_threats)} tone={d.kpi.active_threats > 0 ? "bad" : "ok"} />
        <KpiCard label="Open investigations" value={String(d.kpi.open_investigations)} tone={d.kpi.open_investigations > 0 ? "warn" : "ok"} />
        <KpiCard label="Signed events" value={d.kpi.signed_pct} tone="violet" />
        <KpiCard label="Policy violations · 24h" value={String(d.kpi.policy_violations_24h)} tone={d.kpi.policy_violations_24h > 0 ? "warn" : "ok"} />
      </section>

      <section aria-label="Threat heatmap">
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Threats · last 24 hours
        </h2>
        <div className="panel p-4">
          <Heatmap rows={heat} cellSize={14} ariaLabel="24-hour threat heatmap by category" />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-3">
        {/* Active investigations */}
        <div className="col-span-6 flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1">
            Active investigations
          </h2>
          {d.investigations.length === 0 ? (
            <div className="panel p-4 text-12 text-fg-muted">No open investigations.</div>
          ) : (
            <div className="panel divide-y">
              {d.investigations.map((i) => (
                <div key={i.id} className="px-3 py-2 flex items-center gap-3">
                  <StatusDot tone={i.severity === "high" ? "bad" : i.severity === "med" ? "warn" : "info"} label={i.id} />
                  <span className="text-12 text-fg flex-1 truncate">{i.title}</span>
                  <Link href={`/sessions/${i.session_id}`} scroll={false} className="chip hover:border-line/16">
                    {i.session_id}
                  </Link>
                  <span className={cn(
                    "chip",
                    i.evidence_status === "verified" && "ok",
                    i.evidence_status === "pending" && "info",
                    i.evidence_status === "tampered" && "bad",
                  )}>
                    <Signature size={10} aria-hidden /> {i.evidence_status}
                  </span>
                  <span className="font-mono text-11 text-fg-faint w-16 text-right">{i.age}</span>
                  <span className={cn(
                    "chip",
                    i.status === "open" && "warn",
                    i.status === "triage" && "info",
                    i.status === "closed" && "ok",
                  )}>
                    {i.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signed evidence stream */}
        <div className="col-span-6 flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 flex items-center gap-2">
            Signed evidence stream
            <span className="font-sans text-fg-faint normal-case tracking-normal">· chain link verifies prev_hash</span>
          </h2>
          <div className="panel divide-y">
            {d.evidence.map((e) => (
              <div key={e.id} className="px-3 py-2 flex items-center gap-3">
                <span className="font-mono text-11 text-fg-muted w-32 truncate">{e.id}</span>
                <span className="font-mono text-11 text-fg-muted w-24">{e.kind}</span>
                <span className="font-mono text-11 text-fg-faint flex-1 truncate">{e.hash}</span>
                {e.signed ? (
                  <span className="chip ok">
                    <Signature size={10} aria-hidden /> signed
                  </span>
                ) : (
                  <span className="chip warn">
                    <ShieldAlert size={10} aria-hidden /> unsigned
                  </span>
                )}
                <Link href={`/sessions/${e.session_id}`} scroll={false} className="chip hover:border-line/16">
                  {e.session_id}
                </Link>
                <span className="font-mono text-11 text-fg-faint w-20 text-right">{e.at}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
