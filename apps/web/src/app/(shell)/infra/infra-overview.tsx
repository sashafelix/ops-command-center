"use client";

import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { KpiCard } from "@/components/kpi-card";
import { StatusDot } from "@/components/status-dot";
import { Heatmap, type HeatmapRow } from "@/components/heatmap";
import { cn } from "@/lib/utils";

export function InfraOverview({
  initial,
}: {
  initial: RouterOutputs["infra"]["overview"];
}) {
  const q = trpc.infra.overview.useQuery(undefined, {
    initialData: initial,
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "visible" ? 20_000 : false,
  });

  if (q.isLoading || !q.data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-12 panel skel" aria-hidden />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 panel skel" aria-hidden />
          ))}
        </div>
        <div className="h-64 panel skel" aria-hidden />
      </div>
    );
  }

  if (q.error) {
    return (
      <div className="panel p-4">
        <span className="chip bad">Could not load infra — {q.error.message}</span>
      </div>
    );
  }

  const d = q.data;
  const heatRows: HeatmapRow[] = d.load.map((r) => {
    const svc = d.services.find((s) => s.id === r.id);
    return {
      label: svc?.name ?? r.id,
      values: r.values,
      summary: `p95 ${svc?.p95_ms ?? "—"}ms`,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-fg text-13 font-semibold tracking-tight">Infra</h1>
          <p className="text-12 text-fg-muted mt-1">
            Service health, regions, deploys, SLOs, incidents.
          </p>
        </div>
      </header>

      {/* KPI strip */}
      <section aria-label="Infra KPIs" className="grid grid-cols-4 gap-3">
        <KpiCard label="Uptime · 30d" value={d.kpi.uptime} tone="ok" />
        <KpiCard label="MTTR" value={d.kpi.mttr} tone="info" />
        <KpiCard label="Open incidents" value={String(d.kpi.openIncidents)} tone={d.kpi.openIncidents > 0 ? "warn" : "ok"} />
        <KpiCard label="SLOs breached" value={String(d.kpi.slosBreached)} tone={d.kpi.slosBreached > 0 ? "bad" : "ok"} />
      </section>

      {/* Regions */}
      <section aria-label="Regions">
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-2 px-1">Regions</h2>
        <div className="grid grid-cols-4 gap-3">
          {d.regions.map((r) => (
            <div key={r.id} className="panel p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <StatusDot tone={r.status} label={r.id} />
              </div>
              <div className="text-12 text-fg-muted truncate">{r.name}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-auto pt-1 font-mono text-11 text-fg-muted">
                <div className="text-fg-dim">nodes</div>
                <div className="text-fg num text-right">{r.nodes}</div>
                <div className="text-fg-dim">az</div>
                <div className="text-fg num text-right">{r.az}</div>
                <div className="text-fg-dim">cost</div>
                <div className="text-fg num text-right">{r.cost_per_hour}</div>
                <div className="text-fg-dim">traffic</div>
                <div className="text-fg num text-right">{(r.traffic_pct * 100).toFixed(0)}%</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section aria-label="Services">
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-2 px-1">Services</h2>
        <div className="panel overflow-hidden">
          <table className="w-full text-12">
            <thead className="text-fg-faint">
              <tr className="font-mono text-[10.5px] tracking-widest uppercase">
                <th className="text-left px-3 py-2 font-normal w-32">Status</th>
                <th className="text-left px-3 py-2 font-normal">Service</th>
                <th className="text-left px-3 py-2 font-normal w-20">Stack</th>
                <th className="text-left px-3 py-2 font-normal w-32">Region</th>
                <th className="text-right px-3 py-2 font-normal w-20">Replicas</th>
                <th className="text-right px-3 py-2 font-normal w-16">CPU</th>
                <th className="text-right px-3 py-2 font-normal w-16">Mem</th>
                <th className="text-right px-3 py-2 font-normal w-20">RPS</th>
                <th className="text-right px-3 py-2 font-normal w-16">Err</th>
                <th className="text-right px-3 py-2 font-normal w-20">P95</th>
                <th className="text-left px-3 py-2 font-normal w-20">Ver</th>
              </tr>
            </thead>
            <tbody>
              {d.services.map((s) => (
                <Row key={s.id} s={s} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CPU heatbars */}
      <section aria-label="CPU load · 60 min">
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-2 px-1">
          CPU load · last 60 min
        </h2>
        <div className="panel p-4">
          <Heatmap rows={heatRows} ariaLabel="60 minute CPU load by service" />
        </div>
      </section>

      {/* Incidents + Deploys */}
      <section className="grid grid-cols-12 gap-3">
        <div className="col-span-7 flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1">
            Open incidents
          </h2>
          {d.incidents.length === 0 ? (
            <div className="panel p-6 text-center text-12 text-fg-muted">No open incidents.</div>
          ) : (
            <div className="panel divide-y">
              {d.incidents.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-3 py-2">
                  <StatusDot tone={i.severity === "high" ? "bad" : i.severity === "med" ? "warn" : "info"} label={i.id} />
                  <span className="text-12 text-fg flex-1 truncate">{i.title}</span>
                  <span className="font-mono text-11 text-fg-muted">{i.service_id}</span>
                  <span className="text-11 text-fg-muted w-20">{i.assignee}</span>
                  <span className="text-11 text-fg-faint w-16 text-right">{i.age}</span>
                  <span
                    className={cn(
                      "chip",
                      i.status === "investigating" && "warn",
                      i.status === "monitoring" && "info",
                      i.status === "resolved" && "ok",
                    )}
                  >
                    {i.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-5 flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1">
            Recent deploys
          </h2>
          <div className="panel divide-y">
            {d.deploys.map((dep) => (
              <div key={dep.id} className="flex items-center gap-3 px-3 py-2">
                <StatusDot tone={dep.status} label={dep.version} />
                <span className="text-12 text-fg-muted flex-1 truncate">{dep.service}</span>
                <span className="text-11 text-fg-muted">{dep.who}</span>
                <span className="text-11 text-fg-faint w-20 text-right">{dep.when}</span>
                {dep.rollback_candidate && <span className="chip warn">rollback?</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SLOs */}
      <section aria-label="SLOs">
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-2 px-1">SLOs</h2>
        <div className="panel overflow-hidden">
          <table className="w-full text-12">
            <thead className="text-fg-faint">
              <tr className="font-mono text-[10.5px] tracking-widest uppercase">
                <th className="text-left px-3 py-2 font-normal">Objective</th>
                <th className="text-right px-3 py-2 font-normal w-24">Target</th>
                <th className="text-right px-3 py-2 font-normal w-24">Actual</th>
                <th className="text-right px-3 py-2 font-normal w-24">Burn rate</th>
                <th className="text-right px-3 py-2 font-normal w-24">State</th>
              </tr>
            </thead>
            <tbody>
              {d.slos.map((s) => (
                <tr key={s.id} className="border-t hover:bg-[var(--hover-soft)]">
                  <td className="px-3 py-2 text-fg">{s.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-fg-muted num">{s.target}</td>
                  <td className="px-3 py-2 text-right font-mono text-fg num">{s.actual}</td>
                  <td className="px-3 py-2 text-right font-mono num">
                    <span className={s.state === "bad" ? "text-bad" : s.state === "warn" ? "text-warn" : "text-fg-muted"}>{s.burn_rate}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn("chip", s.state === "ok" && "ok", s.state === "warn" && "warn", s.state === "bad" && "bad")}>{s.state}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Row({
  s,
}: {
  s: {
    id: string;
    name: string;
    stack: string;
    region: string;
    status: "ok" | "warn" | "bad";
    replicas: string;
    cpu_pct: number;
    mem_pct: number;
    rps: number;
    error_pct: number;
    p95_ms: number;
    version: string;
    reason?: string;
  };
}) {
  return (
    <>
      <tr className="border-t hover:bg-[var(--hover-soft)]">
        <td className="px-3 py-2"><StatusDot tone={s.status} label={s.id} /></td>
        <td className="px-3 py-2 text-fg truncate">{s.name}</td>
        <td className="px-3 py-2 text-fg-muted">{s.stack}</td>
        <td className="px-3 py-2 text-fg-muted">{s.region}</td>
        <td className="px-3 py-2 text-right font-mono text-fg-muted num">{s.replicas}</td>
        <td className={cn("px-3 py-2 text-right font-mono num", s.cpu_pct > 0.75 ? "text-warn" : "text-fg")}>
          {(s.cpu_pct * 100).toFixed(0)}%
        </td>
        <td className={cn("px-3 py-2 text-right font-mono num", s.mem_pct > 0.75 ? "text-warn" : "text-fg-muted")}>
          {(s.mem_pct * 100).toFixed(0)}%
        </td>
        <td className="px-3 py-2 text-right font-mono text-fg-muted num">{s.rps.toLocaleString()}</td>
        <td className={cn("px-3 py-2 text-right font-mono num", s.error_pct > 0.01 ? "text-bad" : "text-fg-muted")}>
          {(s.error_pct * 100).toFixed(2)}%
        </td>
        <td className={cn("px-3 py-2 text-right font-mono num", s.p95_ms > 1000 ? "text-warn" : "text-fg-muted")}>
          {s.p95_ms}ms
        </td>
        <td className="px-3 py-2 font-mono text-fg-muted">{s.version}</td>
      </tr>
      {s.reason && (
        <tr className="border-t bg-warn/[0.04]">
          <td colSpan={11} className="px-3 py-1.5 text-12 text-warn">
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-warn/80 mr-2">reason</span>
            {s.reason}
          </td>
        </tr>
      )}
    </>
  );
}
