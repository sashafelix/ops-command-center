"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { KpiCard } from "@/components/kpi-card";
import { Sparkline } from "@/components/sparkline";
import { StatusDot } from "@/components/status-dot";
import { BurnBar } from "@/components/budget/burn-bar";
import { burnPct, burnTone } from "@/components/budget/burn";
import { MtdBurnChart } from "@/components/budget/mtd-burn-chart";
import { fmtUSD, cn } from "@/lib/utils";

export function BudgetsView() {
  const q = trpc.budgets.overview.useQuery();

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
          <h1 className="text-fg text-13 font-semibold tracking-tight">Budgets</h1>
          <p className="text-12 text-fg-muted mt-1">
            Per-team caps, MTD burn, top-cost runs, forecast.
          </p>
        </div>
      </header>

      <section aria-label="Budget KPIs" className="grid grid-cols-4 gap-3">
        <KpiCard
          label="Spend · today"
          value={fmtUSD(d.kpi.spend_24h)}
          delta={`${burnPct(d.kpi.spend_24h, d.kpi.cap_day)}% of $${d.kpi.cap_day.toFixed(0)} cap`}
          tone={burnTone(d.kpi.spend_24h, d.kpi.cap_day)}
        />
        <KpiCard
          label="Spend · MTD"
          value={fmtUSD(d.kpi.spend_mtd)}
          delta={`${burnPct(d.kpi.spend_mtd, d.kpi.cap_month)}% of $${d.kpi.cap_month.toFixed(0)} cap`}
          tone={burnTone(d.kpi.spend_mtd, d.kpi.cap_month)}
        />
        <KpiCard
          label="Forecast · EOM"
          value={fmtUSD(d.kpi.forecast)}
          delta={d.kpi.forecast > d.kpi.cap_month ? "over cap" : "under cap"}
          tone={d.kpi.forecast > d.kpi.cap_month ? "bad" : "ok"}
        />
        <KpiCard
          label="Breaches · 30d"
          value={String(d.kpi.breaches_30d)}
          tone={d.kpi.breaches_30d > 0 ? "warn" : "ok"}
        />
      </section>

      {/* MTD burn chart */}
      <section>
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          MTD burn · cap line
        </h2>
        <div className="panel p-4">
          <MtdBurnChart daily={d.mtd_daily} capLine={d.cap_line} width={1280} height={160} />
          <div className="flex items-center gap-4 mt-2 font-mono text-11 text-fg-muted">
            <Legend swatch="rgb(var(--info))" label="daily spend" />
            <Legend swatch="rgb(var(--warn))" label="$/day cap" dashed />
            <span className="ml-auto">today · day {d.mtd_daily.length}</span>
          </div>
        </div>
      </section>

      {/* Per-team */}
      <section>
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Per-team budgets
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {d.teams.map((t) => (
            <article key={t.id} className="panel p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <StatusDot tone={t.status} label={t.label} />
                <span className="ml-auto font-mono text-11 text-fg-muted num">{t.trend}</span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint">
                    Today
                  </div>
                  <div className="text-fg text-[18px] font-semibold num">{fmtUSD(t.spend_24h)}</div>
                  <div className="font-mono text-11 text-fg-faint num">/ ${t.cap.toFixed(0)} cap</div>
                </div>
                <Sparkline values={t.spark} tone={t.status} width={80} height={22} />
              </div>
              <BurnBar spend={t.spend_24h} cap={t.cap} />
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1 font-mono text-11 text-fg-muted">
                <div className="text-fg-dim">MTD</div>
                <div className="text-fg num text-right">{fmtUSD(t.mtd)}</div>
                <div className="text-fg-dim">MTD cap</div>
                <div className="text-fg-muted num text-right">{fmtUSD(t.cap_mtd)}</div>
                <div className="text-fg-dim">Agents</div>
                <div className="text-fg-muted num text-right">{t.agents}</div>
                <div className="text-fg-dim">Runs · 24h</div>
                <div className="text-fg-muted num text-right">{t.runs}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Top-cost runs */}
      <section>
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Top-cost runs
        </h2>
        <div className="panel overflow-hidden">
          <table className="w-full text-12">
            <thead className="text-fg-faint">
              <tr className="font-mono text-[10.5px] tracking-widest uppercase">
                <th className="text-left px-3 py-2 font-normal w-32">Status</th>
                <th className="text-left px-3 py-2 font-normal">Goal</th>
                <th className="text-left px-3 py-2 font-normal w-32">Agent</th>
                <th className="text-right px-3 py-2 font-normal w-20">Cost</th>
                <th className="text-right px-3 py-2 font-normal w-24">Duration</th>
                <th className="text-right px-3 py-2 font-normal w-28">When</th>
              </tr>
            </thead>
            <tbody>
              {d.top_runs.map((r) => (
                <tr key={r.id} className="border-t hover:bg-[var(--hover-soft)]">
                  <td className="px-3 py-2">
                    <StatusDot tone={r.status === "aborted" ? "bad" : (r.status as "ok" | "warn" | "bad")} label={r.id} />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/sessions/${r.id}`} scroll={false} className="text-fg hover:text-info truncate inline-block max-w-full">
                      {r.goal}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-fg-muted">{r.agent}</td>
                  <td className={cn("px-3 py-2 text-right font-mono num", r.cost_usd > 5 ? "text-bad" : "text-fg")}>
                    {fmtUSD(r.cost_usd)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-fg-muted num">{r.duration}</td>
                  <td className="px-3 py-2 text-right text-fg-muted">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Breaches */}
      {d.breaches.length > 0 && (
        <section>
          <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
            Recent breaches · 30d
          </h2>
          <div className="panel divide-y">
            {d.breaches.map((b) => (
              <div key={b.id} className="px-3 py-2 flex items-center gap-3 text-12">
                <StatusDot tone={b.resolved ? "ok" : "bad"} label={b.team} />
                <span className="font-mono text-fg-muted">{b.cap}</span>
                <span className="font-mono text-fg num">{b.amount}</span>
                <span className="text-fg-muted ml-auto">{b.action}</span>
                <span className="text-11 text-fg-faint w-20 text-right">{b.when}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Legend({
  swatch,
  label,
  dashed,
}: {
  swatch: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block w-4 h-px"
        style={{
          background: dashed ? undefined : swatch,
          borderTop: dashed ? `1px dashed ${swatch}` : undefined,
        }}
        aria-hidden
      />
      {label}
    </span>
  );
}
