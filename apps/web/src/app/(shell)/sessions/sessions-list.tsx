"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { StatusDot } from "@/components/status-dot";
import { fmtUSD, cn } from "@/lib/utils";

const ROW_HEIGHT = 36;
const SAVED_VIEWS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live now" },
  { id: "watch", label: "Trust < 0.85" },
] as const;
type ViewId = (typeof SAVED_VIEWS)[number]["id"];

export function SessionsList() {
  const q = trpc.sessions.list.useQuery();
  const [view, setView] = useState<ViewId>("all");

  const rows = useMemo(() => {
    const all = q.data ?? [];
    if (view === "live") return all.filter((r) => r.when === "live");
    if (view === "watch") return all.filter((r) => r.trust_score < 0.85);
    return all;
  }, [q.data, view]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-fg text-13 font-semibold tracking-tight">Sessions</h1>
          <p className="text-12 text-fg-muted mt-1">
            Searchable list of every session — live and historical. Saved views in v1 are hardcoded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {SAVED_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={cn(
                "h-7 px-2 text-12 rounded panel2 hover:border-line2",
                view === v.id ? "text-fg border-line/16" : "text-fg-muted",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </header>

      {q.isLoading ? (
        <div className="panel">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-9 skel border-t first:border-t-0" aria-hidden />
          ))}
        </div>
      ) : q.error ? (
        <div className="panel p-4">
          <span className="chip bad">Could not load sessions — {q.error.message}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="panel p-8 text-center text-12 text-fg-muted">No sessions match this view.</div>
      ) : (
        <div className="panel">
          {/* Header row (sticky) */}
          <div className="flex items-center px-3 py-2 border-b font-mono text-[10.5px] tracking-widest uppercase text-fg-faint">
            <Cell w={120}>Status</Cell>
            <Cell flex>Goal</Cell>
            <Cell w={140}>Agent · Model</Cell>
            <Cell w={90} right>Cost</Cell>
            <Cell w={70} right>Tools</Cell>
            <Cell w={90} right>Trust</Cell>
            <Cell w={90} right>Duration</Cell>
            <Cell w={110} right>When</Cell>
            <Cell w={32} right />
          </div>

          {/* Virtualized body */}
          <div ref={parentRef} className="max-h-[60vh] overflow-y-auto">
            <div
              style={{
                height: virt.getTotalSize(),
                position: "relative",
                width: "100%",
              }}
            >
              {virt.getVirtualItems().map((vi) => {
                const r = rows[vi.index]!;
                return (
                  <Link
                    key={r.id}
                    href={`/sessions/${r.id}`}
                    scroll={false}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      transform: `translateY(${vi.start}px)`,
                      width: "100%",
                      height: ROW_HEIGHT,
                    }}
                    className="flex items-center px-3 border-t hover:bg-white/[0.02] text-12"
                  >
                    <Cell w={120}>
                      <StatusDot tone={r.status === "idle" ? "info" : r.status} label={r.id} />
                    </Cell>
                    <Cell flex>
                      <span className="truncate text-fg" title={r.goal}>{r.goal}</span>
                    </Cell>
                    <Cell w={140}>
                      <span className="text-fg-muted truncate">{r.agent} · {r.model}</span>
                    </Cell>
                    <Cell w={90} right>
                      <span className="font-mono text-fg num">{fmtUSD(r.cost_usd)}</span>
                    </Cell>
                    <Cell w={70} right>
                      <span className="font-mono text-fg-muted num">{r.tools}</span>
                    </Cell>
                    <Cell w={90} right>
                      <span
                        className={cn(
                          "font-mono num",
                          r.trust_score < 0.8 ? "text-warn" : "text-fg-muted",
                        )}
                      >
                        {r.trust_score.toFixed(2)}
                      </span>
                    </Cell>
                    <Cell w={90} right>
                      <span className="font-mono text-fg-muted num">{r.duration}</span>
                    </Cell>
                    <Cell w={110} right>
                      <span className="text-fg-muted">{r.when}</span>
                    </Cell>
                    <Cell w={32} right>
                      <ArrowRight size={12} className="text-fg-faint" aria-hidden />
                    </Cell>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t font-mono text-[10.5px] text-fg-faint flex items-center justify-between">
            <span>— end of page · 600 more —</span>
            <span className="num">{rows.length} shown</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({
  children,
  w,
  flex,
  right,
}: {
  children?: React.ReactNode;
  w?: number;
  flex?: boolean;
  right?: boolean;
}) {
  return (
    <div
      style={{ width: flex ? undefined : w, minWidth: flex ? 0 : w }}
      className={cn(
        "px-1 truncate flex items-center",
        flex && "flex-1 min-w-0",
        right && "justify-end",
      )}
    >
      {children}
    </div>
  );
}
