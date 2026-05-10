"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, DollarSign, Terminal, ArrowRight, GitBranch, Cpu } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { getWsClient } from "@/lib/ws/client";
import { fmtDur, fmtUSD } from "@/lib/utils";
import type { NowPlayingTick } from "@ops/shared";

/**
 * Persistent strip on every tab except Settings + Reports (HANDOFF §2).
 * Initial snapshot from tRPC; runtime + cost subsequently driven by WS ticks.
 * Tick handler writes directly to refs so siblings don't re-render.
 */
export function NowPlaying() {
  const snapshot = trpc.live.now.useQuery();
  const runtimeRef = useRef<HTMLSpanElement | null>(null);
  const costRef = useRef<HTMLSpanElement | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const client = getWsClient();
    const off = client.subscribe("now-playing", (payload) => {
      const tick = payload as NowPlayingTick;
      if (runtimeRef.current) runtimeRef.current.textContent = fmtDur(tick.runtime_s);
      if (costRef.current) costRef.current.textContent = fmtUSD(tick.cost_usd);
    });
    return off;
  }, []);

  // Re-render once when snapshot arrives so refs hydrate with text content
  useEffect(() => {
    if (snapshot.data) force((n) => n + 1);
  }, [snapshot.data]);

  if (!snapshot.data) {
    return (
      <section className="border-b">
        <div className="h-12 px-4 flex items-center">
          <div className="h-5 w-48 skel rounded" aria-hidden />
        </div>
      </section>
    );
  }

  const n = snapshot.data;

  return (
    <section className="border-b" aria-label="Now playing">
      <div className="flex items-center h-12 px-4 gap-4">
        <div className="flex items-center gap-2 pr-3 border-r h-full">
          <span className="relative inline-flex items-center justify-center w-3 h-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-ok/30 animate-ringpulse" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-ok animate-breathe" />
          </span>
          <span className="font-mono text-11 tracking-widest text-fg-muted">NOW PLAYING</span>
        </div>

        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="chip">
            <Cpu size={12} aria-hidden />
            {n.agent}
          </span>
          <span className="chip">{n.model}</span>
          <span className="chip">
            <GitBranch size={12} aria-hidden />
            {n.repo}
          </span>
          <span className="text-13 text-fg truncate min-w-0 flex-1">{n.goal}</span>
        </div>

        <div className="flex items-center gap-5 font-mono text-12 text-fg-muted">
          <span className="flex items-center gap-1.5">
            <Clock size={12} className="text-fg-dim" aria-hidden />
            <span ref={runtimeRef} className="text-fg num">
              {fmtDur(n.runtime_s)}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <DollarSign size={12} className="text-fg-dim" aria-hidden />
            <span ref={costRef} className="text-fg num">
              {fmtUSD(n.cost_usd)}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <Terminal size={12} className="text-fg-dim" aria-hidden />
            <span className="text-fg num">{n.tools}</span>
            <span className="text-fg-dim">tools</span>
          </span>
          <Link
            href={`/sessions/${n.id}`}
            className="flex items-center gap-1.5 text-fg hover:text-info"
          >
            Open <ArrowRight size={12} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
