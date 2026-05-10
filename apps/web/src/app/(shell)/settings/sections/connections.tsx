"use client";

import { Plug } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import type { Connection } from "@/server/mock/seed";
import { cn } from "@/lib/utils";

export function ConnectionsSection({ items }: { items: Connection[] }) {
  // Group by category for the layout the mock implies
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
            {conns.map((c) => (
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
                <footer className="flex items-center gap-2 mt-1">
                  <span className={cn("chip", c.health === "warn" && "warn", c.health === "bad" && "bad", c.health === "ok" && "ok")}>
                    {c.fields.length} field{c.fields.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-11 text-fg-faint ml-auto">last sync · {c.last_sync}</span>
                </footer>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
