"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle2, XCircle, Loader2, Download } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { KpiCard } from "@/components/kpi-card";
import { verifyChain, type AuditRow, type ChainVerification } from "@ops/shared";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 32;

export function AuditLogView() {
  const kpi = trpc.auditLog.kpi.useQuery();
  const facets = trpc.auditLog.facets.useQuery();
  const list = trpc.auditLog.list.useQuery({ limit: 500, offset: 0 });
  const chain = trpc.auditLog.chain.useQuery();

  const [filterActor, setFilterActor] = useState<string>("");
  const [filterAction, setFilterAction] = useState<string>("");
  const [verifyState, setVerifyState] = useState<{
    status: "idle" | "running" | "ok" | "bad";
    elapsed_ms?: number | undefined;
    detail?: string | undefined;
    rows?: number | undefined;
  }>({ status: "idle" });

  const rows = useMemo(() => {
    const all = list.data?.rows ?? [];
    return [...all].reverse().filter((r) => {
      if (filterActor && r.actor !== filterActor) return false;
      if (filterAction && r.action !== filterAction) return false;
      return true;
    });
  }, [list.data?.rows, filterActor, filterAction]);

  async function runVerify() {
    if (!chain.data) return;
    setVerifyState({ status: "running" });
    const t0 = performance.now();
    const result: ChainVerification = await verifyChain(chain.data as unknown as AuditRow[]);
    const elapsed_ms = performance.now() - t0;
    if (result.ok) {
      setVerifyState({ status: "ok", elapsed_ms, rows: result.rowsChecked });
    } else {
      setVerifyState({
        status: "bad",
        elapsed_ms,
        rows: result.rowsChecked,
        detail: result.reason,
      });
    }
  }

  function exportRows(format: "csv" | "jsonl") {
    if (!chain.data) return;
    const data = chain.data as unknown as AuditRow[];
    const blob =
      format === "jsonl"
        ? new Blob([data.map((r) => JSON.stringify(r)).join("\n")], { type: "application/x-ndjson" })
        : new Blob([toCsv(data)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${Date.now()}.${format === "jsonl" ? "jsonl" : "csv"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const parentRef = useRef<HTMLDivElement | null>(null);
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-fg text-13 font-semibold tracking-tight">Audit log</h1>
          <p className="text-12 text-fg-muted mt-1">
            Append-only, hash-chained, anchored hourly. Chain integrity is verified client-side.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ChainChip state={verifyState} onClick={runVerify} loading={!chain.data} />
          <button
            type="button"
            onClick={() => exportRows("csv")}
            disabled={!chain.data}
            className="h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5"
          >
            <Download size={12} aria-hidden /> CSV
          </button>
          <button
            type="button"
            onClick={() => exportRows("jsonl")}
            disabled={!chain.data}
            className="h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5"
          >
            <Download size={12} aria-hidden /> JSONL
          </button>
        </div>
      </header>

      <section aria-label="Audit KPIs" className="grid grid-cols-4 gap-3">
        <KpiCard label="Events · 24h" value={(kpi.data?.events_24h ?? 0).toLocaleString()} />
        <KpiCard label="Unique actors" value={String(kpi.data?.unique_actors ?? 0)} />
        <KpiCard
          label="Chain integrity"
          value={verifyState.status === "ok" ? "100%" : verifyState.status === "bad" ? "fail" : `${kpi.data?.chain_integrity_pct ?? "—"}%`}
          tone={verifyState.status === "bad" ? "bad" : "ok"}
        />
        <KpiCard label="Retention" value={kpi.data?.retention ?? "—"} delta={`anchored ${kpi.data?.anchored ?? 0}`} />
      </section>

      <section className="flex items-center gap-2">
        <span className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint">filter</span>
        <Select
          label="actor"
          value={filterActor}
          options={facets.data?.actors ?? []}
          onChange={setFilterActor}
        />
        <Select
          label="action"
          value={filterAction}
          options={facets.data?.actions ?? []}
          onChange={setFilterAction}
        />
        <span className="ml-auto font-mono text-11 text-fg-muted num">{rows.length} of {list.data?.total ?? 0}</span>
      </section>

      <section>
        <div className="panel">
          <div className="flex items-center px-3 py-2 border-b font-mono text-[10.5px] tracking-widest uppercase text-fg-faint">
            <Cell w={172}>Timestamp</Cell>
            <Cell w={140}>Actor · role</Cell>
            <Cell w={170}>Action</Cell>
            <Cell flex>Target</Cell>
            <Cell w={140}>IP</Cell>
            <Cell w={120}>Hash</Cell>
            <Cell w={20} />
          </div>

          <div ref={parentRef} className="max-h-[60vh] overflow-y-auto">
            <div style={{ height: virt.getTotalSize(), position: "relative", width: "100%" }}>
              {virt.getVirtualItems().map((vi) => {
                const r = rows[vi.index]!;
                const anchorIdx = verifyState.status === "bad" && verifyState.rows === vi.index;
                return (
                  <div
                    key={r.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      transform: `translateY(${vi.start}px)`,
                      width: "100%",
                      height: ROW_HEIGHT,
                    }}
                    className={cn(
                      "flex items-center px-3 border-t hover:bg-[var(--hover-soft)] text-12",
                      anchorIdx && "bg-bad/10",
                    )}
                  >
                    <Cell w={172}>
                      <span className="font-mono text-11 text-fg-muted">{r.ts}</span>
                    </Cell>
                    <Cell w={140}>
                      <span className="text-fg-muted truncate">{r.actor} · {r.role}</span>
                    </Cell>
                    <Cell w={170}>
                      <span className="font-mono text-11 text-fg">{r.action}</span>
                    </Cell>
                    <Cell flex>
                      <span className="font-mono text-11 text-fg-muted truncate">{r.target}</span>
                    </Cell>
                    <Cell w={140}>
                      <span className="font-mono text-11 text-fg-faint">{r.ip}</span>
                    </Cell>
                    <Cell w={120}>
                      <span className="font-mono text-11 text-fg-faint truncate">{r.hash.slice(0, 10)}…</span>
                    </Cell>
                    <Cell w={20}>
                      {r.anchored_at && <span title="anchored" className="text-violet">⚓</span>}
                    </Cell>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-3 py-2 border-t font-mono text-[10.5px] text-fg-faint flex items-center justify-between">
            <span>chain ordered tail-first; verifier walks oldest → newest</span>
            <span>{rows.length} rows displayed</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function ChainChip({
  state,
  onClick,
  loading,
}: {
  state: {
    status: "idle" | "running" | "ok" | "bad";
    elapsed_ms?: number | undefined;
    rows?: number | undefined;
    detail?: string | undefined;
  };
  onClick: () => void;
  loading: boolean;
}) {
  const label = (() => {
    if (state.status === "running") return "verifying…";
    if (state.status === "ok") return `verified ${state.rows} rows · ${Math.round(state.elapsed_ms ?? 0)}ms`;
    if (state.status === "bad") return `failed at row ${state.rows} · ${state.detail}`;
    return "verify chain";
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || state.status === "running"}
      className={cn(
        "h-8 px-3 panel2 hover:border-line2 text-12 flex items-center gap-1.5",
        // Reserve room for the longest variant so the chip never shifts neighbors.
        "min-w-[14rem] justify-start",
        state.status === "ok" && "border-ok/40 text-ok",
        state.status === "bad" && "border-bad/40 text-bad",
        state.status === "idle" && "text-fg-muted hover:text-fg",
      )}
    >
      {state.status === "running" ? (
        <Loader2 size={12} className="animate-spin" aria-hidden />
      ) : state.status === "ok" ? (
        <CheckCircle2 size={12} aria-hidden />
      ) : state.status === "bad" ? (
        <XCircle size={12} aria-hidden />
      ) : (
        <CheckCircle2 size={12} aria-hidden />
      )}
      {label}
    </button>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="h-7 px-2 panel2 text-12 text-fg-muted flex items-center gap-1.5">
      <span className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-fg outline-none"
      >
        <option value="">all</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Cell({
  children,
  w,
  flex,
}: {
  children?: React.ReactNode;
  w?: number;
  flex?: boolean;
}) {
  return (
    <div
      style={{ width: flex ? undefined : w, minWidth: flex ? 0 : w }}
      className={cn("px-1 truncate flex items-center", flex && "flex-1 min-w-0")}
    >
      {children}
    </div>
  );
}

function toCsv(rows: AuditRow[]): string {
  const headers = ["id", "ts", "actor", "role", "action", "target", "ip", "ua", "prev_hash", "hash", "anchored_at"] as const;
  const head = headers.join(",");
  const body = rows.map((r) =>
    headers
      .map((h) => {
        const v = (r as Record<string, unknown>)[h];
        if (v === undefined || v === null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(","),
  );
  return [head, ...body].join("\n");
}
