"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_GROUPS, type NavItem } from "./nav-config";
import { lsGet, lsSet, StorageKeys } from "@/lib/storage";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Map a destination id to the tRPC procedure most likely to be needed when
 * its page mounts. Hovering / focusing the link kicks off both a Next.js
 * route prefetch and a tRPC cache warm so the click feels instant.
 */
type Utils = ReturnType<typeof trpc.useUtils>;
type Prefetch = (utils: Utils) => Promise<unknown> | unknown;
const PREFETCH_BY_DESTINATION: Record<string, Prefetch> = {
  live: (u) => Promise.all([u.live.kpi.prefetch(), u.sessions.liveBoard.prefetch()]),
  sessions: (u) => u.sessions.list.prefetch(),
  approvals: (u) => u.approvals.inbox.prefetch(),
  infra: (u) => u.infra.overview.prefetch(),
  "status-page": (u) => u.statusPage.overview.prefetch({ mode: "internal" }),
  agents: (u) => u.agents.overview.prefetch(),
  evals: (u) => u.evals.overview.prefetch(),
  budgets: (u) => u.budgets.overview.prefetch(),
  trust: (u) => u.trust.overview.prefetch(),
  "audit-log": (u) => Promise.all([u.auditLog.kpi.prefetch(), u.auditLog.list.prefetch()]),
  reports: (u) => u.reports.overview.prefetch(),
  settings: (u) => u.settings.overview.prefetch(),
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => lsGet(StorageKeys.sidebarCollapsed, false));
  const pathname = usePathname();
  const router = useRouter();
  const utils = trpc.useUtils();
  const badgesQuery = trpc.live.navBadges.useQuery(undefined, { staleTime: 60_000 });
  const badges: Record<string, number> = badgesQuery.data ?? {};

  useEffect(() => lsSet(StorageKeys.sidebarCollapsed, collapsed), [collapsed]);

  // Single hover-warmer used by every item — kicks off router + tRPC prefetches.
  const prefetch = useCallback(
    (item: NavItem) => {
      router.prefetch(item.href);
      const fn = PREFETCH_BY_DESTINATION[item.id];
      if (fn) void Promise.resolve(fn(utils)).catch(() => undefined);
    },
    [router, utils],
  );

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "sticky top-12 h-[calc(100vh-3rem)] shrink-0 overflow-y-auto border-r",
        "bg-ink-0 transition-[width] duration-200 ease-out",
        collapsed ? "w-[60px]" : "w-[232px]",
      )}
      aria-label="Primary navigation"
    >
      <nav className="flex flex-col gap-4 py-4 px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {!collapsed && (
              <div className="font-mono text-[10.5px] tracking-widest text-fg-faint px-2 mb-1.5">
                {group.label}
              </div>
            )}
            {collapsed && <div className="mx-auto w-6 h-px bg-line/10 mb-1" />}
            {group.items.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                collapsed={collapsed}
                active={isActive(pathname, item.href)}
                badge={badges[item.id] ?? 0}
                onPrefetch={prefetch}
              />
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t mt-2 px-2 py-3 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          className="w-8 h-8 inline-flex items-center justify-center text-fg-muted hover:text-fg hover:bg-[var(--hover)] rounded"
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({
  item,
  collapsed,
  active,
  badge,
  onPrefetch,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  badge: number;
  onPrefetch: (item: NavItem) => void;
}) {
  const Icon = item.icon;
  const warmHandlers = {
    onMouseEnter: () => onPrefetch(item),
    onFocus: () => onPrefetch(item),
  };
  if (collapsed) {
    return (
      <Link
        href={item.href}
        title={item.label}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        {...warmHandlers}
        className={cn(
          "relative w-10 h-10 mx-auto flex items-center justify-center rounded",
          active ? "bg-[var(--hover)] text-fg" : "text-fg-dim hover:text-fg hover:bg-[var(--hover-soft)]",
        )}
      >
        <Icon size={16} />
        {badge > 0 && (
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-bad"
            aria-label={`${badge} pending`}
          />
        )}
      </Link>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      {...warmHandlers}
      className={cn(
        "group relative h-8 px-2 rounded flex items-center gap-2 text-12",
        active ? "bg-[var(--hover)] text-fg" : "text-fg-muted hover:text-fg hover:bg-[var(--hover-soft)]",
      )}
    >
      <Icon size={14} className={active ? "text-fg" : "text-fg-dim group-hover:text-fg"} />
      <span className="flex-1 truncate">{item.label}</span>
      {badge > 0 && (
        <span className="font-mono text-[10px] text-bad tabular-nums">{badge}</span>
      )}
    </Link>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
