"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { Check, X, Pencil, Pause, Clock, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { KpiCard } from "@/components/kpi-card";
import { StatusDot } from "@/components/status-dot";
import { useCountdown, fmtCountdown } from "@/components/approvals/countdown";
import { removeApprovalById } from "@/components/approvals/optimistic";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { cn } from "@/lib/utils";

type Decision = "approve" | "deny" | "edit" | "snooze";

export function ApprovalsQueue({ initial }: { initial: RouterOutputs["approvals"]["inbox"] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const inbox = trpc.approvals.inbox.useQuery(undefined, {
    initialData: initial,
    staleTime: 5_000,
  });

  const decide = trpc.approvals.decide.useMutation({
    onMutate: async ({ id }) => {
      await utils.approvals.inbox.cancel();
      const previous = utils.approvals.inbox.getData();
      utils.approvals.inbox.setData(undefined, (cur) => (cur ? removeApprovalById(cur, id) : cur));
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      // Rollback on failure
      if (ctx?.previous) utils.approvals.inbox.setData(undefined, ctx.previous);
    },
    onSettled: () => {
      void utils.approvals.inbox.invalidate();
    },
  });

  const onDecide = useCallback(
    async (id: string, decision: Decision) => {
      const ok = await requireFreshAuth(`Confirm to ${decision} approval ${id}.`);
      if (!ok) return;
      decide.mutate({ id, decision });
    },
    [decide, requireFreshAuth],
  );

  // Top-row keyboard shortcuts: A/D/E/S for the topmost pending card
  useEffect(() => {
    function isTyping(t: EventTarget | null) {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      const top = inbox.data?.queue[0];
      if (!top) return;
      const k = e.key.toLowerCase();
      const map: Record<string, Decision> = { a: "approve", d: "deny", e: "edit", s: "snooze" };
      const decision = map[k];
      if (!decision) return;
      e.preventDefault();
      void onDecide(top.id, decision);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inbox.data?.queue, onDecide]);

  const counts = inbox.data?.counts;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-fg text-13 font-semibold tracking-tight">Approvals</h1>
          <p className="text-12 text-fg-muted mt-1">
            Human-in-the-loop queue for risky tool calls. <span className="font-mono">A</span> approve,{" "}
            <span className="font-mono">D</span> deny, <span className="font-mono">E</span> edit,{" "}
            <span className="font-mono">S</span> snooze.
          </p>
        </div>
      </header>

      <section aria-label="Approval KPIs" className="grid grid-cols-3 gap-3">
        <KpiCard label="Pending" value={(counts?.pending ?? 0).toString()} tone="warn" />
        <KpiCard label="Auto-approved · 24h" value={(counts?.autoApproved24h ?? 0).toLocaleString()} tone="ok" />
        <KpiCard label="Blocked · 24h" value={(counts?.blocked24h ?? 0).toString()} tone="bad" />
      </section>

      <section aria-label="Review queue" className="grid grid-cols-12 gap-3">
        <div className="col-span-8 flex flex-col gap-3">
          <h2 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1">
            Review queue
          </h2>
          {inbox.isLoading ? (
            <>
              <div className="h-32 panel skel" aria-hidden />
              <div className="h-32 panel skel" aria-hidden />
              <div className="h-32 panel skel" aria-hidden />
            </>
          ) : inbox.error ? (
            <div className="panel p-4">
              <span className="chip bad">Could not load queue — {inbox.error.message}</span>
            </div>
          ) : (inbox.data?.queue.length ?? 0) === 0 ? (
            <div className="panel p-8 text-center">
              <div className="text-13 text-fg">Queue is clear.</div>
              <div className="text-12 text-fg-muted mt-1">Stay paranoid.</div>
            </div>
          ) : (
            inbox.data!.queue.map((row, i) => (
              <ApprovalCard
                key={row.id}
                row={row}
                isTop={i === 0}
                pending={decide.isPending && decide.variables?.id === row.id}
                onDecide={onDecide}
              />
            ))
          )}
        </div>

        <div className="col-span-4 flex flex-col gap-4">
          <RecentVerdicts items={inbox.data?.recent ?? []} loading={inbox.isLoading} />
          <Policies items={inbox.data?.policies ?? []} loading={inbox.isLoading} />
        </div>
      </section>
    </div>
  );
}

function ApprovalCard({
  row,
  isTop,
  pending,
  onDecide,
}: {
  row: {
    id: string;
    severity: "low" | "med" | "high";
    policy: string;
    agent: string;
    session_id: string;
    goal: string;
    action: string;
    command: string;
    justification: string;
    blast_radius: string;
    auto_deny_at: string;
    requires: number;
    of: number;
  };
  isTop: boolean;
  pending: boolean;
  onDecide: (id: string, decision: Decision) => void | Promise<void>;
}) {
  const remaining = useCountdown(row.auto_deny_at);
  const sevTone = row.severity === "high" ? "bad" : row.severity === "med" ? "warn" : "info";
  return (
    <article
      data-testid="approval-card"
      data-id={row.id}
      className={cn(
        "panel p-4 flex flex-col gap-3",
        pending && "opacity-50 pointer-events-none",
      )}
    >
      <header className="flex items-center gap-3">
        <StatusDot tone={sevTone} label={`${row.severity}`} />
        <span className="chip">{row.policy}</span>
        <span className="chip">{row.action}</span>
        <Link href={`/sessions/${row.session_id}`} scroll={false} className="chip hover:border-line/16 inline-flex items-center gap-1">
          {row.session_id} <ArrowRight size={10} aria-hidden />
        </Link>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-11 text-fg-muted">
          <Clock size={11} className={remaining < 60 ? "text-bad" : "text-fg-dim"} aria-hidden />
          <span className={cn("num", remaining < 60 ? "text-bad" : "text-fg")} aria-label="auto-deny in">
            {fmtCountdown(remaining)}
          </span>
        </span>
        {row.requires > 1 && (
          <span className="font-mono text-11 text-fg-faint">{row.requires}/{row.of}</span>
        )}
      </header>

      <pre className="panel2 px-3 py-2 font-mono text-12 text-fg overflow-x-auto whitespace-pre-wrap break-all">
        {row.command}
      </pre>

      <div className="grid grid-cols-2 gap-3 text-12">
        <div>
          <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-1">
            Justification
          </div>
          <p className="text-fg">{row.justification}</p>
        </div>
        <div>
          <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-1">
            Blast radius
          </div>
          <p className="text-fg">{row.blast_radius}</p>
        </div>
      </div>

      <footer className="flex items-center gap-2 mt-1">
        <Action label="Approve" hint={isTop ? "A" : undefined} onClick={() => onDecide(row.id, "approve")} icon={<Check size={12} aria-hidden />} tone="ok" />
        <Action label="Deny" hint={isTop ? "D" : undefined} onClick={() => onDecide(row.id, "deny")} icon={<X size={12} aria-hidden />} tone="bad" />
        <Action label="Edit" hint={isTop ? "E" : undefined} onClick={() => onDecide(row.id, "edit")} icon={<Pencil size={12} aria-hidden />} />
        <Action label="Snooze" hint={isTop ? "S" : undefined} onClick={() => onDecide(row.id, "snooze")} icon={<Pause size={12} aria-hidden />} />
      </footer>
    </article>
  );
}

function Action({
  label,
  hint,
  onClick,
  icon,
  tone,
}: {
  label: string;
  hint?: string | undefined;
  onClick: () => void;
  icon: React.ReactNode;
  tone?: "ok" | "bad";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 px-2.5 panel2 hover:border-line2 text-12 flex items-center gap-1.5",
        tone === "ok" && "text-ok hover:border-ok/40",
        tone === "bad" && "text-bad hover:border-bad/40",
        !tone && "text-fg-muted hover:text-fg",
      )}
    >
      {icon}
      {label}
      {hint && <span className="kbd ml-1">{hint}</span>}
    </button>
  );
}

function RecentVerdicts({
  items,
  loading,
}: {
  items: Array<{ id: string; verdict: "approved" | "denied" | "edited" | "expired"; by: string; when: string; what: string; session_id: string }>;
  loading: boolean;
}) {
  return (
    <section>
      <h3 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
        Recent verdicts
      </h3>
      {loading ? (
        <div className="panel">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 skel border-t first:border-t-0" aria-hidden />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="panel p-3 text-12 text-fg-muted">No recent verdicts.</div>
      ) : (
        <ul className="panel divide-y">
          {items.map((v) => (
            <li key={v.id} className="px-3 py-2 flex items-center gap-2 text-12">
              <span
                className={cn(
                  "chip",
                  v.verdict === "approved" && "ok",
                  v.verdict === "denied" && "bad",
                  v.verdict === "edited" && "info",
                  v.verdict === "expired" && "warn",
                )}
              >
                {v.verdict}
              </span>
              <span className="text-fg truncate flex-1">{v.what}</span>
              <span className="text-fg-muted">{v.by}</span>
              <span className="text-fg-faint w-20 text-right">{v.when}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Policies({
  items,
  loading,
}: {
  items: Array<{ id: string; name: string; surface: string; mode: string; enabled: boolean }>;
  loading: boolean;
}) {
  return (
    <section>
      <h3 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
        Policies
      </h3>
      {loading ? (
        <div className="panel">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 skel border-t first:border-t-0" aria-hidden />
          ))}
        </div>
      ) : (
        <ul className="panel divide-y">
          {items.map((p) => (
            <li key={p.id} className="px-3 py-2 flex items-center gap-2 text-12">
              <StatusDot tone={p.enabled ? "ok" : "info"} label={p.name} />
              <span className="text-fg-muted truncate flex-1 ml-2">{p.surface}</span>
              <span className="font-mono text-11 text-fg-faint">{p.mode}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
