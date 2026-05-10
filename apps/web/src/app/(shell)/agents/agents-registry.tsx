"use client";

import { trpc } from "@/lib/trpc/client";
import { KpiCard } from "@/components/kpi-card";
import { Sparkline } from "@/components/sparkline";
import { StatusDot } from "@/components/status-dot";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { fmtUSD, cn } from "@/lib/utils";
import { RotateCcw, Key } from "lucide-react";

export function AgentsRegistry() {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const q = trpc.agents.overview.useQuery();
  const rollback = trpc.agents.rollback.useMutation({
    onSuccess: () => void utils.agents.overview.invalidate(),
  });

  async function handleRollback(deployId: string, agent: string, fromV: string, toV: string) {
    const ok = await requireFreshAuth(`Confirm rollback of ${agent}: ${toV} → ${fromV}.`);
    if (!ok) return;
    rollback.mutate({ deploy_id: deployId });
  }

  if (q.isLoading || !q.data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
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
          <h1 className="text-fg text-13 font-semibold tracking-tight">Agents</h1>
          <p className="text-12 text-fg-muted mt-1">
            Registry of agent versions, channels, signing keys, deploy history.
          </p>
        </div>
      </header>

      <section aria-label="Agents KPIs" className="grid grid-cols-5 gap-3">
        <KpiCard label="Registered" value={String(d.kpi.total)} />
        <KpiCard label="Active" value={String(d.kpi.active)} tone="ok" />
        <KpiCard label="Paused" value={String(d.kpi.paused)} tone="warn" />
        <KpiCard label="Avg trust" value={d.kpi.avg_trust.toFixed(2)} tone="violet" />
        <KpiCard label="Deploys · 24h" value={String(d.kpi.deploys_24h)} tone="info" />
      </section>

      {/* Registry table */}
      <section>
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">Registry</h2>
        <div className="panel overflow-hidden">
          <table className="w-full text-12">
            <thead className="text-fg-faint">
              <tr className="font-mono text-[10.5px] tracking-widest uppercase">
                <th className="text-left px-3 py-2 font-normal w-44">Agent</th>
                <th className="text-left px-3 py-2 font-normal w-20">Channel</th>
                <th className="text-left px-3 py-2 font-normal w-20">Status</th>
                <th className="text-left px-3 py-2 font-normal w-28">Model</th>
                <th className="text-right px-3 py-2 font-normal w-20">Runs · 24h</th>
                <th className="text-right px-3 py-2 font-normal w-24">Cost · 24h</th>
                <th className="text-right px-3 py-2 font-normal w-16">Trust</th>
                <th className="text-right px-3 py-2 font-normal w-16">P95</th>
                <th className="text-left px-3 py-2 font-normal w-20">Signed</th>
                <th className="px-3 py-2 font-normal w-24" />
              </tr>
            </thead>
            <tbody>
              {d.list.map((a) => (
                <tr key={a.id} className="border-t hover:bg-[var(--hover-soft)]">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <StatusDot tone={a.status === "active" ? "ok" : a.status === "paused" ? "warn" : "info"} label={a.id} />
                      <span className="font-mono text-11 text-fg-faint">v{a.version}</span>
                    </div>
                    <div className="text-11 text-fg-muted ml-4 mt-0.5">owner · {a.owner}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("chip", a.channel === "stable" && "ok", a.channel === "canary" && "warn", a.channel === "shadow" && "info")}>
                      {a.channel}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-fg-muted">{a.status}</td>
                  <td className="px-3 py-2 text-fg-muted">{a.model}</td>
                  <td className="px-3 py-2 text-right font-mono text-fg num">{a.runs_24h.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono text-fg num">{fmtUSD(a.cost_24h)}</td>
                  <td className="px-3 py-2 text-right font-mono text-fg-muted num">{a.trust.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-fg-muted num">{a.p95_s.toFixed(1)}s</td>
                  <td className="px-3 py-2">
                    <span className={cn("chip", a.signed ? "ok" : "warn")}>{a.signed ? "signed" : "unsigned"}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Sparkline values={a.spark} tone={a.status === "paused" ? "warn" : "info"} width={64} height={18} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Deploys + Keys */}
      <section className="grid grid-cols-12 gap-3">
        <div className="col-span-7 flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1">Recent deploys</h2>
          <div className="panel divide-y">
            {d.deploys.map((dep) => (
              <div key={dep.id} className="px-3 py-2 flex items-center gap-3">
                <span className="font-mono text-11 text-fg num w-32 shrink-0">{dep.agent}</span>
                <span className="font-mono text-11 text-fg-muted">{dep.from}</span>
                <span className="text-fg-faint">→</span>
                <span className="font-mono text-11 text-fg num">{dep.to}</span>
                <span className={cn("chip", dep.channel === "stable" && "ok", dep.channel === "canary" && "warn", dep.channel === "shadow" && "info")}>
                  {dep.channel}
                </span>
                <span className="text-11 text-fg-muted ml-auto">{dep.who}</span>
                <span className="text-11 text-fg-faint w-20 text-right">{dep.when}</span>
                <span className={cn(
                  "font-mono text-11 num w-16 text-right",
                  dep.eval_delta.startsWith("+") ? "text-ok" : dep.eval_delta.startsWith("-") ? "text-bad" : "text-fg-muted",
                )}>{dep.eval_delta}</span>
                <span className={cn(
                  "font-mono text-11 num w-16 text-right",
                  dep.cost_delta.startsWith("-") ? "text-ok" : dep.cost_delta.startsWith("+") ? "text-bad" : "text-fg-muted",
                )}>{dep.cost_delta}</span>
                <button
                  type="button"
                  onClick={() => void handleRollback(dep.id, dep.agent, dep.from, dep.to)}
                  disabled={dep.status === "rolled-back" || rollback.isPending}
                  className="h-7 px-2 panel2 text-11 text-fg-muted hover:text-fg flex items-center gap-1 disabled:opacity-40"
                >
                  <RotateCcw size={11} aria-hidden /> {dep.status === "rolled-back" ? "rolled back" : "rollback"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-5 flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1">Signing keys</h2>
          <div className="panel divide-y">
            {d.keys.map((k) => (
              <div key={k.fingerprint} className="px-3 py-2 flex items-center gap-3">
                <Key size={11} className="text-fg-faint" aria-hidden />
                <span className="font-mono text-11 text-fg truncate flex-1">{k.fingerprint}</span>
                <span className="text-11 text-fg-muted">{k.agent}</span>
                <span className="font-mono text-11 text-fg-faint">{k.algo}</span>
                <span className="font-mono text-11 text-fg-muted num w-16 text-right">{k.sigs_24h}</span>
                <span className="text-11 text-fg-faint w-20 text-right">{k.last_used}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
