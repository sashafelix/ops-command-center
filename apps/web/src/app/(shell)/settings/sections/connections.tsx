"use client";

import { useState } from "react";
import { Plug, Loader2, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { StatusDot } from "@/components/status-dot";
import type { Connection } from "@/server/mock/seed";
import { cn } from "@/lib/utils";

// Which connection ids have a real connector wired up. Used to enable/disable
// the Test button — keeps the UX honest about which sources can actually be
// reached vs. stay configurable-but-stubbed for now.
const TESTABLE = new Set(["anthropic", "github", "proxmox"]);

export function ConnectionsSection({ items }: { items: Connection[] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const [pending, setPending] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, { ok: boolean; detail: string }>>({});

  const test = trpc.settings.testConnection.useMutation({
    onSettled: () => {
      setPending(null);
      void utils.settings.overview.invalidate();
    },
    onSuccess: (r, vars) => {
      setLastResult((prev) => ({ ...prev, [vars.id]: r }));
    },
  });

  async function onTest(id: string, name: string) {
    const ok = await requireFreshAuth(`Test connection to ${name}.`);
    if (!ok) return;
    setPending(id);
    test.mutate({ id });
  }

  const byCategory = items.reduce<Record<string, Connection[]>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-13 font-semibold text-fg">Connections</h2>
      {Object.entries(byCategory).map(([category, conns]) => (
        <section key={category}>
          <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
            {category}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {conns.map((c) => {
              const result = lastResult[c.id];
              const isPending = pending === c.id;
              const canTest = TESTABLE.has(c.id);
              return (
                <article key={c.id} className="panel p-3 flex flex-col gap-2">
                  <header className="flex items-center gap-2">
                    <Plug size={12} className="text-fg-faint" aria-hidden />
                    <span className="text-13 text-fg flex-1 truncate">{c.name}</span>
                    <StatusDot
                      tone={c.health === "ok" ? "ok" : c.health === "warn" ? "warn" : "bad"}
                      label={c.status}
                    />
                  </header>
                  <div className="text-11 text-fg-muted truncate">{c.detail}</div>
                  {result && (
                    <div className={cn("text-11", result.ok ? "text-ok" : "text-bad")}>
                      {result.ok ? "✓" : "✗"} {result.detail}
                    </div>
                  )}
                  <footer className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        "chip",
                        c.health === "warn" && "warn",
                        c.health === "bad" && "bad",
                        c.health === "ok" && "ok",
                      )}
                    >
                      {c.fields.length} field{c.fields.length === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void onTest(c.id, c.name)}
                      disabled={!canTest || isPending}
                      title={canTest ? "Run a reachability check" : "No connector wired up (stub-only)"}
                      className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg-muted hover:text-fg flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isPending ? (
                        <Loader2 size={11} className="animate-spin" aria-hidden />
                      ) : (
                        <Zap size={11} aria-hidden />
                      )}
                      Test
                    </button>
                    <span className="text-11 text-fg-faint ml-auto">last sync · {c.last_sync}</span>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
