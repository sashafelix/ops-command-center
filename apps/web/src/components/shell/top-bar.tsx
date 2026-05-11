"use client";

import Link from "next/link";
import { Bell, HelpCircle, LayoutGrid, Search } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { AccountInitials } from "./account-initials";
import { useCommandPalette } from "@/components/cmdk/command-palette";

export function TopBar() {
  const { open } = useCommandPalette();
  return (
    <header className="sticky top-0 z-30 bg-ink-1/85 backdrop-blur supports-[backdrop-filter]:bg-ink-1/70 border-b">
      <div className="flex items-stretch h-12 px-5 gap-4">
        <Link
          href="/live"
          className="flex items-center gap-2 pr-3 mr-1 text-fg hover:opacity-80"
        >
          <LayoutGrid size={16} aria-hidden />
          <span className="font-semibold tracking-tight text-13">Ops Command Center</span>
        </Link>

        <button
          type="button"
          onClick={open}
          className="flex items-center gap-3 h-8 px-3 my-2 panel2 hover:border-line2 text-fg-muted hover:text-fg transition-colors w-[420px] max-w-full"
        >
          <Search size={14} className="opacity-80" aria-hidden />
          <span className="text-12">Search sessions, agents, commands…</span>
          <span className="ml-auto flex gap-1">
            <span className="kbd">⌘</span>
            <span className="kbd">K</span>
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            type="button"
            title="Notifications"
            aria-label="Notifications"
            className="relative w-8 h-8 flex items-center justify-center text-fg-muted hover:text-fg hover:bg-[var(--hover)] rounded"
          >
            <Bell size={16} aria-hidden />
          </button>

          <button
            type="button"
            title="Help (?)"
            aria-label="Help"
            className="w-8 h-8 flex items-center justify-center text-fg-muted hover:text-fg hover:bg-[var(--hover)] rounded"
          >
            <HelpCircle size={16} aria-hidden />
          </button>

          <ThemeToggle />

          <span className="w-px h-5 bg-line/10 mx-1" aria-hidden />

          <button
            type="button"
            className="flex items-center gap-2 h-8 pl-1 pr-2 hover:bg-[var(--hover)] rounded"
            aria-label="Account"
          >
            <AccountInitials />
          </button>
        </div>
      </div>
    </header>
  );
}
