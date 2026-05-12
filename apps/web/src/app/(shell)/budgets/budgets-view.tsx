"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { KpiCard } from "@/components/kpi-card";
import { Sparkline } from "@/components/sparkline";
import { StatusDot } from "@/components/status-dot";
import { BurnBar } from "@/components/budget/burn-bar";
import { burnPct, burnTone } from "@/components/budget/burn";
import { MtdBurnChart } from "@/components/budget/mtd-burn-chart";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { fmtUSD, cn } from "@/lib/utils";

export function BudgetsView({ initial }: { initial: RouterOutputs["budgets"]["overview"] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const q = trpc.budgets.overview.useQuery(undefined, { initialData: initial });

  const setCap = trpc.budgets.setCap.useMutation({
    onSuccess: () => void utils.budgets.overview.invalidate(),
  });
  const setWsCaps = trpc.budgets.setWorkspaceCaps.useMutation({
    onSuccess: () => void utils.budgets.overview.invalidate(),
  });
  const resolveBreach = trpc.budgets.resolveBreach.useMutation({
    onSuccess: () => void utils.budgets.overview.invalidate(),
  });

  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingWs, setEditingWs] = useState(false);

  async function onSaveTeamCap(team_id: string, daily_cap: number, cap_mtd: number) {
    const ok = await requireFreshAuth(`Update caps for ${team_id}.`);
    if (!ok) return;
    setCap.mutate({ team_id, daily_cap, cap_mtd }, {
      onSuccess: () => setEditingTeam(null),
    });
  }

  async function onSaveWsCaps(cap_day: number, cap_month: number) {
    const ok = await requireFreshAuth("Update workspace caps.");
    if (!ok) return;
    setWsCaps.mutate({ cap_day, cap_month }, {
      onSuccess: () => setEditingWs(false),
    });
  }

  async function onResolveBreach(id: string, team: string) {
    const ok = await requireFreshAuth(`Resolve breach ${id} (${team}).`);
    if (!ok) return;
    resolveBreach.mutate({ id });
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
          <h1 className="text-fg text-13 font-semibold tracking-tight">Budgets</h1>
          <p className="text-12 text-fg-muted mt-1">
            Per-team caps, MTD burn, top-cost runs, forecast.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditingWs(true)}
          className="h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5"
        >
          <Pencil size={12} aria-hidden /> Workspace caps
        </button>
      </header>

      {editingWs && (
        <WorkspaceCapsDialog
          initialDay={d.kpi.cap_day}
          initialMonth={d.kpi.cap_month}
          busy={setWsCaps.isPending}
          error={setWsCaps.error?.message ?? null}
          onCancel={() => setEditingWs(false)}
          onSave={onSaveWsCaps}
        />
      )}

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
                <button
                  type="button"
                  onClick={() => setEditingTeam(t.id)}
                  aria-label={`Edit caps for ${t.label}`}
                  title="Edit caps"
                  className="h-6 w-6 inline-flex items-center justify-center text-fg-faint hover:text-fg"
                >
                  <Pencil size={11} aria-hidden />
                </button>
              </div>
              {editingTeam === t.id ? (
                <TeamCapEditor
                  initialDaily={t.cap}
                  initialMtd={t.cap_mtd}
                  busy={setCap.isPending && setCap.variables?.team_id === t.id}
                  error={setCap.error?.message ?? null}
                  onCancel={() => setEditingTeam(null)}
                  onSave={(daily, mtd) => void onSaveTeamCap(t.id, daily, mtd)}
                />
              ) : (
                <>
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
                </>
              )}
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
            {d.breaches.map((b) => {
              const busy = resolveBreach.isPending && resolveBreach.variables?.id === b.id;
              return (
                <div key={b.id} className="px-3 py-2 flex items-center gap-3 text-12">
                  <StatusDot tone={b.resolved ? "ok" : "bad"} label={b.team} />
                  <span className="font-mono text-fg-muted">{b.cap}</span>
                  <span className="font-mono text-fg num">{b.amount}</span>
                  <span className="text-fg-muted ml-auto">{b.action}</span>
                  <span className="text-11 text-fg-faint w-20 text-right">{b.when}</span>
                  {b.resolved ? (
                    <span className="chip ok">resolved</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onResolveBreach(b.id, b.team)}
                      disabled={busy}
                      className="h-6 px-1.5 panel2 hover:border-line2 text-11 text-fg-muted hover:text-fg inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={10} className="animate-spin" aria-hidden /> : <Check size={10} aria-hidden />}
                      Resolve
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function TeamCapEditor({
  initialDaily,
  initialMtd,
  busy,
  error,
  onCancel,
  onSave,
}: {
  initialDaily: number;
  initialMtd: number;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (daily: number, mtd: number) => void;
}) {
  const [daily, setDaily] = useState(String(initialDaily));
  const [mtd, setMtd] = useState(String(initialMtd));
  const dailyNum = Number(daily);
  const mtdNum = Number(mtd);
  const valid = Number.isFinite(dailyNum) && dailyNum >= 0 && Number.isFinite(mtdNum) && mtdNum >= 0;
  return (
    <div className="flex flex-col gap-2">
      <label className="grid grid-cols-3 items-center gap-2">
        <span className="text-11 text-fg-muted">Daily cap</span>
        <div className="col-span-2 flex items-center gap-1">
          <span className="text-11 text-fg-faint">$</span>
          <input
            type="number"
            min={0}
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            className="flex-1 h-7 panel2 bg-transparent px-2 font-mono text-11 text-fg outline-none focus:border-line2"
          />
        </div>
      </label>
      <label className="grid grid-cols-3 items-center gap-2">
        <span className="text-11 text-fg-muted">MTD cap</span>
        <div className="col-span-2 flex items-center gap-1">
          <span className="text-11 text-fg-faint">$</span>
          <input
            type="number"
            min={0}
            value={mtd}
            onChange={(e) => setMtd(e.target.value)}
            className="flex-1 h-7 panel2 bg-transparent px-2 font-mono text-11 text-fg outline-none focus:border-line2"
          />
        </div>
      </label>
      {error && <p className="text-11 text-bad truncate">{error}</p>}
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-7 px-2 text-11 text-fg-muted hover:text-fg disabled:opacity-50"
        >
          <X size={11} className="inline -mt-px" aria-hidden /> Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(dailyNum, mtdNum)}
          disabled={busy || !valid}
          className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 size={11} className="animate-spin" aria-hidden /> : <Check size={11} aria-hidden />}
          Save
        </button>
      </div>
    </div>
  );
}

function WorkspaceCapsDialog({
  initialDay,
  initialMonth,
  busy,
  error,
  onCancel,
  onSave,
}: {
  initialDay: number;
  initialMonth: number;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (day: number, month: number) => void;
}) {
  const [day, setDay] = useState(String(initialDay));
  const [month, setMonth] = useState(String(initialMonth));
  const dayNum = Number(day);
  const monthNum = Number(month);
  const valid = Number.isFinite(dayNum) && dayNum >= 0 && Number.isFinite(monthNum) && monthNum >= 0;
  return (
    <article className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint">
          Workspace caps
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="h-6 w-6 inline-flex items-center justify-center text-fg-faint hover:text-fg"
        >
          <X size={11} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-11 text-fg-muted">$/day cap</span>
          <input
            type="number"
            min={0}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-8 panel2 bg-transparent px-2 font-mono text-12 text-fg outline-none focus:border-line2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-11 text-fg-muted">$/month cap</span>
          <input
            type="number"
            min={0}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-8 panel2 bg-transparent px-2 font-mono text-12 text-fg outline-none focus:border-line2"
          />
        </label>
      </div>
      {error && <p className="text-11 text-bad mt-2">{error}</p>}
      <div className="flex items-center gap-2 justify-end mt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-8 px-3 text-12 text-fg-muted hover:text-fg disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(dayNum, monthNum)}
          disabled={busy || !valid}
          className="h-8 px-3 panel2 hover:border-line2 text-12 text-fg flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Check size={12} aria-hidden />}
          Save caps
        </button>
      </div>
    </article>
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
