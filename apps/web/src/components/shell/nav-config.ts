import type { LucideIcon } from "lucide-react";
import {
  Zap,
  List,
  Gavel,
  Server,
  Globe,
  User,
  Beaker,
  DollarSign,
  Shield,
  Signature,
  Calendar,
  Settings,
} from "lucide-react";

export type NavItem = {
  /** URL slug under '/' */
  id: string;
  label: string;
  href: `/${string}`;
  icon: LucideIcon;
  /** 1-based shortcut number, when bound */
  shortcut?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

/**
 * Single source of truth for the sidebar + Cmd+K Navigate section.
 * Order matches HANDOFF §2: 5 groups, 11 destinations + Reports + Settings.
 * Keyboard shortcuts 1–8 map to the first 8 destinations per HANDOFF §7.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "operate",
    label: "OPERATE",
    items: [
      { id: "live", label: "Live", href: "/live", icon: Zap, shortcut: 1 },
      { id: "sessions", label: "Sessions", href: "/sessions", icon: List, shortcut: 2 },
      { id: "approvals", label: "Approvals", href: "/approvals", icon: Gavel, shortcut: 3 },
    ],
  },
  {
    id: "infra",
    label: "INFRASTRUCTURE",
    items: [
      { id: "infra", label: "Infra", href: "/infra", icon: Server, shortcut: 4 },
      { id: "status-page", label: "Status page", href: "/status-page", icon: Globe },
    ],
  },
  {
    id: "agents",
    label: "AGENTS",
    items: [
      { id: "agents", label: "Agents", href: "/agents", icon: User, shortcut: 5 },
      { id: "evals", label: "Evals", href: "/evals", icon: Beaker, shortcut: 6 },
      { id: "budgets", label: "Budgets", href: "/budgets", icon: DollarSign, shortcut: 7 },
    ],
  },
  {
    id: "security",
    label: "SECURITY",
    items: [
      { id: "trust", label: "Trust", href: "/trust", icon: Shield, shortcut: 8 },
      { id: "audit-log", label: "Audit log", href: "/audit-log", icon: Signature },
    ],
  },
  {
    id: "workspace",
    label: "WORKSPACE",
    items: [
      { id: "reports", label: "Reports", href: "/reports", icon: Calendar },
      { id: "settings", label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const ALL_DESTINATIONS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Routes that suppress the NOW PLAYING strip per HANDOFF §2. */
export const NOW_PLAYING_SUPPRESSED = new Set<string>(["/reports", "/settings"]);

export function suppressNowPlaying(pathname: string): boolean {
  for (const prefix of NOW_PLAYING_SUPPRESSED) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}
