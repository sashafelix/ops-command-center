import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { ChromeShell } from "@/components/shell/chrome-shell";

// Auth-gated chrome — never statically prerender.
export const dynamic = "force-dynamic";

export default async function ShellLayout({
  children,
  overlay,
}: {
  children: ReactNode;
  overlay: ReactNode;
}) {
  const session = await auth();
  const initials = pickInitials(session?.user?.name ?? session?.user?.email ?? "?");
  return (
    <ChromeShell initials={initials}>
      {children}
      {overlay}
    </ChromeShell>
  );
}

function pickInitials(s: string): string {
  const parts = s.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]![0] ?? "?").toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[1]![0] ?? "")).toUpperCase();
}
