"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { KpiCard } from "@/components/kpi-card";
import { Sparkline } from "@/components/sparkline";
import { StatusDot } from "@/components/status-dot";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { cn } from "@/lib/utils";

type Toast = { id: string; suite: string; runId: string };

export function EvalsView({ initial }: { initial: RouterOutputs["evals"]["overview"] }) {
  const utils = trpc.useUtils();
  // Refetch on a short interval whenever any run is in flight so the
  // running state + pass_rate update without manual reload. Once nothing's
  // running we drop back to a long stale time so the page is cheap.
  const q = trpc.evals.overview.useQuery(undefined, {
    initialData: initial,
    refetchInterval: (query) => (query.state.data?.suites.some((s) => s.running) ? 2_000 : false),
  });
  const recentRuns = trpc.evals.recentRuns.useQuery(
    { limit: 20 },
    {
      refetchInterval: (query) => {
        const data = query.state.data ?? [];
        return data.some((r) => r.status === "queued" || r.status === "running") ? 2_000 : 10_000;
      },
    },
  );
  const { requireFreshAuth } = useReauthGate();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const run = trpc.evals.runSuite.useMutation({
    onSuccess: (r) => {
      const id = `${r.run_id}-${Date.now()}`;
      setToasts((t) => [...t, { id, suite: r.suite_id, runId: r.run_id }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
      void utils.evals.overview.invalidate();
      void utils.evals.recentRuns.invalidate();
    },
  });

  async function handleRun(suiteId: string) {
    const ok = await requireFreshAuth(`Confirm run of suite ${suiteId}.`);
    if (!ok) return;
    run.mutate({ suite_id: suiteId });
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
          <h1 className="text-fg text-13 font-semibold tracking-tight">Evals</h1>
          <p className="text-12 text-fg-muted mt-1">
            Suites, A/B comparisons, regressions, baseline drift.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-5 gap-3">
        <KpiCard label="Suites" value={String(d.kpi.suites)} />
        <KpiCard label="Total cases" value={d.kpi.total_cases.toLocaleString()} />
        <KpiCard label="Passing" value={d.kpi.passing} tone="ok" />
        <KpiCard label="Open regressions" value={String(d.kpi.regressions)} tone={d.kpi.regressions > 0 ? "bad" : "ok"} />
        <KpiCard label="Drift" value={d.kpi.drift} tone={d.kpi.drift.startsWith("-") ? "warn" : "ok"} />
      </section>

      <section className="grid grid-cols-12 gap-3">
        <div className="col-span-8 flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1">Suites</h2>
          <div className="panel overflow-hidden">
            <table className="w-full text-12">
              <thead className="text-fg-faint">
                <tr className="font-mono text-[10.5px] tracking-widest uppercase">
                  <th className="text-left px-3 py-2 font-normal">Suite · model</th>
                  <th className="text-right px-3 py-2 font-normal w-16">Cases</th>
                  <th className="text-right px-3 py-2 font-normal w-20">Pass</th>
                  <th className="text-right px-3 py-2 font-normal w-20">Δ</th>
                  <th className="text-right px-3 py-2 font-normal w-20">Flake</th>
                  <th className="px-3 py-2 font-normal w-28 text-right">Trend</th>
                  <th className="text-right px-3 py-2 font-normal w-24">Last</th>
                  <th className="px-3 py-2 font-normal w-20" />
                </tr>
              </thead>
              <tbody>
                {d.suites.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-[var(--hover-soft)]">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <StatusDot tone={s.status} label={s.id} />
                        {s.running && (
                          <span
                            className="chip info inline-flex items-center gap-1"
                            title="A run is queued or in progress"
                          >
                            <Loader2 size={10} className="animate-spin" aria-hidden /> running
                          </span>
                        )}
                      </div>
                      <div className="text-11 text-fg-muted ml-4 mt-0.5">{s.model}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-fg-muted num">{s.cases}</td>
                    <td className="px-3 py-2 text-right font-mono text-fg num">{(s.pass_rate * 100).toFixed(1)}%</td>
                    <td className={cn(
                      "px-3 py-2 text-right font-mono num",
                      s.delta < 0 ? "text-bad" : s.delta > 0 ? "text-ok" : "text-fg-muted",
                    )}>{(s.delta * 100).toFixed(1)}%</td>
                    <td className={cn("px-3 py-2 text-right font-mono num", s.flake_rate > 0.02 ? "text-warn" : "text-fg-muted")}>
                      {(s.flake_rate * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Sparkline values={s.trend} tone={s.status} width={88} height={18} />
                    </td>
                    <td className="px-3 py-2 text-right text-11 text-fg-muted">{s.last}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void handleRun(s.id)}
                        disabled={run.isPending || s.running}
                        title={s.running ? "A run is already in flight" : "Queue a run"}
                        className="h-7 px-2 panel2 text-11 text-fg-muted hover:text-fg flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {s.running ? (
                          <Loader2 size={11} className="animate-spin" aria-hidden />
                        ) : (
                          <Play size={11} aria-hidden />
                        )}
                        Run
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-span-4 flex flex-col gap-3">
          {/* A/B card */}
          <section className="panel p-4">
            <h3 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-3">
              A/B in flight
            </h3>
            <div className="text-12 text-fg-muted mb-3">{d.ab.name}</div>
            <ABBar a={d.ab.a} b={d.ab.b} />
            <div className="flex items-center justify-between mt-3 font-mono text-11 text-fg-muted">
              <span>{d.ab.trials}</span>
              <span className="text-ok">{d.ab.significance}</span>
            </div>
          </section>

          {/* Regressions */}
          <section>
            <h3 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
              Open regressions
            </h3>
            {d.regressions.length === 0 ? (
              <div className="panel p-4 text-12 text-fg-muted">No open regressions.</div>
            ) : (
              <div className="panel divide-y">
                {d.regressions.map((r) => (
                  <div key={r.id} className="px-3 py-2 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-12">
                      <span className="chip">{r.suite}</span>
                      <span className="text-fg truncate">{r.case}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-11 text-fg-muted">
                      <span>{r.model}</span>
                      <span className="num">×{r.occurrences}</span>
                      <span>{r.commit}</span>
                      <span className="ml-auto text-fg-faint">{r.first_fail}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      <section>
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Recent runs
        </h2>
        {recentRuns.isLoading && !recentRuns.data ? (
          <div className="panel p-4 text-12 text-fg-muted">loading…</div>
        ) : (recentRuns.data ?? []).length === 0 ? (
          <div className="panel p-4 text-12 text-fg-muted">No runs yet.</div>
        ) : (
          <div className="panel divide-y">
            {(recentRuns.data ?? []).map((r) => {
              const tone =
                r.status === "passed"
                  ? "text-ok"
                  : r.status === "failed" || r.status === "error"
                    ? "text-bad"
                    : "text-warn";
              const elapsedMs =
                r.finished_at && r.started_at
                  ? Date.parse(r.finished_at) - Date.parse(r.started_at)
                  : null;
              return (
                <div key={r.id} className="px-3 py-2 grid grid-cols-12 items-center gap-2 text-12">
                  <span className={cn("col-span-2 font-mono", tone)}>
                    {r.status === "queued" || r.status === "running" ? (
                      <Loader2 size={11} className="inline animate-spin mr-1" aria-hidden />
                    ) : null}
                    {r.status}
                  </span>
                  <span className="col-span-2 font-mono text-fg-muted truncate">{r.suite_id}</span>
                  <span className="col-span-3 font-mono text-fg-faint truncate">{r.started_by}</span>
                  <span className="col-span-2 text-right font-mono text-fg num">
                    {r.pass_rate != null ? `${(r.pass_rate * 100).toFixed(1)}%` : "—"}
                  </span>
                  <span className="col-span-1 text-right font-mono text-fg-muted num">
                    {r.cases_run != null ? r.cases_run : "—"}
                  </span>
                  <span className="col-span-1 text-right font-mono text-fg-faint num">
                    {elapsedMs != null ? `${(elapsedMs / 1000).toFixed(1)}s` : "—"}
                  </span>
                  <span className="col-span-1 text-right font-mono text-11 text-fg-faint">
                    {relTime(r.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Toast region */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="panel px-3 py-2 text-12 pointer-events-auto animate-appear">
            <span className="text-fg-muted mr-2">queued</span>
            <span className="font-mono text-fg">{t.suite}</span>
            <span className="text-fg-faint mx-2">·</span>
            <span className="font-mono text-info">{t.runId}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ABBar({
  a,
  b,
}: {
  a: { label: string; wins: number; score: number };
  b: { label: string; wins: number; score: number };
}) {
  const total = a.wins + b.wins || 1;
  const aPct = (a.wins / total) * 100;
  return (
    <div className="flex flex-col gap-2">
      <Row label={a.label} wins={a.wins} score={a.score} pct={aPct} tone="info" />
      <Row label={b.label} wins={b.wins} score={b.score} pct={100 - aPct} tone="violet" />
    </div>
  );
}

function Row({
  label,
  wins,
  score,
  pct,
  tone,
}: {
  label: string;
  wins: number;
  score: number;
  pct: number;
  tone: "info" | "violet";
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-12 mb-1">
        <span className="text-fg">{label}</span>
        <span className="font-mono text-fg-muted num">{score.toFixed(1)} · {wins} wins</span>
      </div>
      <div className="w-full h-1.5 bg-ink-3 rounded-full overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: tone === "info" ? "rgb(var(--info))" : "rgb(var(--violet))" }}
        />
      </div>
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
