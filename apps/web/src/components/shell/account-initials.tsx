"use client";

import { useSession } from "next-auth/react";

/**
 * Tiny client component that derives initials from the active session.
 * Lives in the top bar so the shell layout doesn't have to await auth()
 * per server-rendered nav.
 */
export function AccountInitials() {
  const { data: session } = useSession();
  const raw = session?.user?.name ?? session?.user?.email ?? "?";
  const initials = pickInitials(raw);
  return (
    <span className="w-7 h-7 rounded-full bg-ink-4 border flex items-center justify-center text-11 font-mono text-fg">
      {initials}
    </span>
  );
}

function pickInitials(s: string): string {
  const parts = s.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]![0] ?? "?").toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[1]![0] ?? "")).toUpperCase();
}
