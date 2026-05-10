"use client";

import Link from "next/link";
import { Cpu, GitBranch, Clock, DollarSign, Terminal, ArrowRight, Pin } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { KpiCard } from "@/components/kpi-card";
import { Sparkline } from "@/components/sparkline";
import { StatusDot } from "@/components/status-dot";
import { fmtDur, fmtUSD, cn } from "@/lib/utils";

export function LiveBoard() {
  const kpi = trpc.live.kpi.useQuery();
  const board = trpc.sessions.liveBoard.useQuery(undefined, {
    refetchInterval: (q) => (typeof document !== "undefined" && document.visibilityState === "visible" ? 15_000 : false),
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-fg text-13 font-semibold tracking-tight">Live</h1>
          <p className="text-12 text-fg-muted mt-1">
            Anything on fire, anything pending, anything to investigate — all in one glance.
          </p>
        </div>
      </header>

      {/* KPI row */}
      <section aria-label="Last 24h" className="grid grid-cols-4 gap-3">
        {kpi.isLoading || !kpi.data ? (
          <>
            <div className="h-24 panel skel" aria-hidden />
            <div className="h-24 panel skel" aria-hidden />
            <div className="h-24 panel skel" aria-hidden />
            <div className="h-24 panel skel" aria-hidden />
          </>
        ) : (
          <>
            <KpiCard
              label="Spend · 24h"
              value={fmtUSD(kpi.data.spend24h)}
              delta={`${kpi.data.spend24h > kpi.data.spendPrev ? "+" : ""}${(((kpi.data.spend24h - kpi.data.spendPrev) / kpi.data.spendPrev) * 100).toFixed(1)}%`}
              spark={[160, 162, 165, 170, 168, 172, 178, 184]}
              tone="info"
            />
            <KpiCard
              label="Sessions · 24h"
              value={kpi.data.sessions24h.toLocaleString()}
              spark={[488, 510, 528, 540, 558, 580, 598, 612]}
              tone="ok"
            />
            <KpiCard
              label="Tool calls · 24h"
              value={kpi.data.toolCalls24h.toLocaleString()}
              spark={[14210, 15004, 15820, 16441, 17120, 17820, 18121, 18429]}
              tone="info"
            />
            <KpiCard
              label="Trust index"
              value={kpi.data.avgTrust.toFixed(2)}
              delta={`p95 ${kpi.data.p95LatencyS.toFixed(1)}s`}
              spark={[92, 93, 92, 93, 94, 94, 93, 94]}
              tone="violet"
            />
          </>
        )}
      </section>

      {/* Three-column board */}
      <section aria-label="Live board" className="grid grid-cols-12 gap-3">
        {/* Active */}
        <Column
          title="Active"
          count={board.data?.counts.active}
          className="col-span-7"
        >
          {board.isLoading || !board.data ? (
            <SkeletonCards rows={3} />
          ) : board.data.active.length === 0 ? (
            <Empty line="No active sessions. Quiet shift." />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {board.data.active.map((s) => (
                <SessionCard key={s.id} s={s} />
              ))}
            </div>
          )}
        </Column>

        {/* Watching */}
        <Column
          title="Watching"
          count={board.data?.counts.watching}
          className="col-span-5"
        >
          {board.isLoading || !board.data ? (
            <SkeletonCards rows={2} />
          ) : board.data.watching.length === 0 ? (
            <Empty line="No prompt-injection candidates in the last 24h. Stay paranoid." />
          ) : (
            <div className="flex flex-col gap-3">
              {board.data.watching.map((s) => (
                <WatchingCard key={s.id} s={s} />
              ))}
            </div>
          )}
        </Column>

        {/* Recently Done */}
        <Column title="Recently done" count={board.data?.counts.done1h} className="col-span-12">
          {board.isLoading || !board.data ? (
            <SkeletonCards rows={1} tall={false} />
          ) : board.data.done.length === 0 ? (
            <Empty line="Nothing finished in the last hour." />
          ) : (
            <DoneTable rows={board.data.done} />
          )}
        </Column>
      </section>
    </div>
  );
}

function Column({
  title,
  count,
  className,
  children,
}: {
  title: string;
  count: number | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <header className="flex items-baseline justify-between px-1">
        <h2 className="font-mono text-[10.5px] tracking-widest text-fg-faint uppercase">
          {title}
        </h2>
        {typeof count === "number" && count > 0 && (
          <span className="font-mono text-[10.5px] text-fg-muted num">{count}</span>
        )}
      </header>
      {children}
    </section>
  );
}

function SkeletonCards({ rows, tall = true }: { rows: number; tall?: boolean }) {
  return (
    <div className={tall ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}>
      {Array.from({ length: rows * 2 }).map((_, i) => (
        <div key={i} className={cn("panel skel", tall ? "h-32" : "h-9")} aria-hidden />
      ))}
    </div>
  );
}

function Empty({ line }: { line: string }) {
  return (
    <div className="panel p-6 text-center">
      <div className="ascii mb-3" style={{ lineHeight: 1.05 }}>
        {`  ___       _   _    _   _  _  _ \n / _ \\ _ __| |_| |  | | | || \\| |\n| (_) | '_ \\  _| |__| |_| || .\` |\n \\___/| .__/\\__|____/\\___/ |_|\\_|\n      |_|                       `}
      </div>
      <div className="text-12 text-fg-muted">{line}</div>
    </div>
  );
}

function SessionCard({
  s,
}: {
  s: {
    id: string;
    status: "ok" | "warn" | "bad" | "idle";
    agent: string;
    model: string;
    repo: string;
    goal: string;
    runtime_s: number;
    cost_usd: number;
    tools: number;
    trust_score: number;
    step: string;
    spark: number[];
    pinned: boolean;
  };
}) {
  return (
    <Link href={`/sessions/${s.id}`} scroll={false} className="panel p-3 flex flex-col gap-2 hover:border-line/16 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot tone={s.status === "idle" ? "info" : s.status} label={s.id} />
          {s.pinned && <Pin size={11} className="text-fg-faint shrink-0" aria-label="pinned" />}
        </div>
        <Sparkline values={s.spark} tone={s.status === "warn" ? "warn" : "info"} width={72} height={20} />
      </div>
      <div className="text-13 text-fg truncate" title={s.goal}>
        {s.goal}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chip"><Cpu size={11} aria-hidden />{s.agent}</span>
        <span className="chip">{s.model}</span>
        <span className="chip"><GitBranch size={11} aria-hidden />{s.repo}</span>
      </div>
      <div className="font-mono text-11 text-fg-muted truncate">{s.step}</div>
      <div className="flex items-center gap-4 mt-auto pt-1 font-mono text-11 text-fg-muted">
        <span className="flex items-center gap-1"><Clock size={10} className="text-fg-dim" aria-hidden /><span className="text-fg num">{fmtDur(s.runtime_s)}</span></span>
        <span className="flex items-center gap-1"><DollarSign size={10} className="text-fg-dim" aria-hidden /><span className="text-fg num">{fmtUSD(s.cost_usd)}</span></span>
        <span className="flex items-center gap-1"><Terminal size={10} className="text-fg-dim" aria-hidden /><span className="text-fg num">{s.tools}</span></span>
        <span className="ml-auto flex items-center gap-1"><span className="text-fg-dim">trust</span><span className="text-fg num">{s.trust_score.toFixed(2)}</span></span>
      </div>
    </Link>
  );
}

function WatchingCard({
  s,
}: {
  s: {
    id: string;
    status: "ok" | "warn" | "bad" | "idle";
    agent: string;
    model: string;
    repo: string;
    goal: string;
    runtime_s: number;
    cost_usd: number;
    trust_score: number;
    reason: string;
    spark: number[];
  };
}) {
  return (
    <Link
      href={`/sessions/${s.id}`}
      scroll={false}
      className="panel p-3 flex flex-col gap-2 hover:border-line/16 transition-colors border-warn/30"
      style={{ borderColor: "rgb(var(--warn) / 0.30)" }}
    >
      <div className="flex items-center gap-2">
        <StatusDot tone={s.status === "idle" ? "info" : s.status} label={s.id} />
        <span className="font-mono text-11 text-warn ml-auto">watching</span>
      </div>
      <div className="text-13 text-fg truncate">{s.goal}</div>
      <div className="text-12 text-warn">{s.reason}</div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chip"><Cpu size={11} aria-hidden />{s.agent}</span>
        <span className="chip"><GitBranch size={11} aria-hidden />{s.repo}</span>
      </div>
      <div className="flex items-center gap-4 mt-1 font-mono text-11 text-fg-muted">
        <span className="flex items-center gap-1"><Clock size={10} className="text-fg-dim" aria-hidden /><span className="text-fg num">{fmtDur(s.runtime_s)}</span></span>
        <span className="flex items-center gap-1"><DollarSign size={10} className="text-fg-dim" aria-hidden /><span className="text-fg num">{fmtUSD(s.cost_usd)}</span></span>
        <span className="ml-auto flex items-center gap-1"><span className="text-fg-dim">trust</span><span className="text-warn num">{s.trust_score.toFixed(2)}</span></span>
      </div>
    </Link>
  );
}

function DoneTable({
  rows,
}: {
  rows: Array<{
    id: string;
    status: "ok" | "warn" | "bad" | "idle";
    goal: string;
    agent: string;
    cost_usd: number;
    tools: number;
    duration: string;
    when: string;
    trust_score: number;
  }>;
}) {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-12">
        <thead className="text-fg-faint">
          <tr className="font-mono text-[10.5px] tracking-widest uppercase">
            <th className="text-left px-3 py-2 font-normal w-24">Status</th>
            <th className="text-left px-3 py-2 font-normal">Goal</th>
            <th className="text-left px-3 py-2 font-normal w-32">Agent</th>
            <th className="text-right px-3 py-2 font-normal w-20">Cost</th>
            <th className="text-right px-3 py-2 font-normal w-16">Tools</th>
            <th className="text-right px-3 py-2 font-normal w-24">Duration</th>
            <th className="text-right px-3 py-2 font-normal w-20">Trust</th>
            <th className="text-right px-3 py-2 font-normal w-28">When</th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-white/[0.02]">
              <td className="px-3 py-2"><StatusDot tone={r.status === "idle" ? "info" : r.status} label={r.id} /></td>
              <td className="px-3 py-2 text-fg truncate max-w-0"><span className="truncate inline-block max-w-full align-top">{r.goal}</span></td>
              <td className="px-3 py-2 text-fg-muted">{r.agent}</td>
              <td className="px-3 py-2 text-right font-mono text-fg num">{fmtUSD(r.cost_usd)}</td>
              <td className="px-3 py-2 text-right font-mono text-fg-muted num">{r.tools}</td>
              <td className="px-3 py-2 text-right font-mono text-fg-muted num">{r.duration}</td>
              <td className="px-3 py-2 text-right font-mono num">
                <span className={r.trust_score < 0.8 ? "text-warn" : "text-fg-muted"}>{r.trust_score.toFixed(2)}</span>
              </td>
              <td className="px-3 py-2 text-right text-fg-muted">{r.when}</td>
              <td className="px-3 py-2">
                <Link href={`/sessions/${r.id}`} scroll={false} className="text-fg-muted hover:text-info inline-flex items-center"><ArrowRight size={12} aria-label={`Open ${r.id}`} /></Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
