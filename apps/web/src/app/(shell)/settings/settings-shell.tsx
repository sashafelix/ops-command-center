"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { StatusDot } from "@/components/status-dot";
import { cn } from "@/lib/utils";
import { GeneralSection } from "./sections/general";
import { ConnectionsSection } from "./sections/connections";
import { WebhooksSection } from "./sections/webhooks";
import { TokensSection } from "./sections/tokens";
import { MembersSection } from "./sections/members";
import { NotificationsSection } from "./sections/notifications";
import { PrefsSection } from "./sections/prefs";
import { AuditSection } from "./sections/audit";
import { AboutSection } from "./sections/about";

const NAV = [
  { id: "general",       label: "General" },
  { id: "connections",   label: "Connections" },
  { id: "webhooks",      label: "Webhooks" },
  { id: "tokens",        label: "Tokens" },
  { id: "members",       label: "Members" },
  { id: "notifications", label: "Notifications" },
  { id: "prefs",         label: "Preferences" },
  { id: "audit",         label: "Audit (read-only)" },
  { id: "about",         label: "About" },
] as const;

export function SettingsShell({
  section,
  initial,
}: {
  section: string;
  initial: RouterOutputs["settings"]["overview"];
}) {
  const q = trpc.settings.overview.useQuery(undefined, { initialData: initial });
  if (q.isLoading || !q.data) {
    return (
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 h-64 panel skel" aria-hidden />
        <div className="col-span-9 h-64 panel skel" aria-hidden />
      </div>
    );
  }
  const data = q.data;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-fg text-13 font-semibold tracking-tight">Settings</h1>
          <p className="text-12 text-fg-muted mt-1">
            Workspace, connections, members, tokens, webhooks, prefs, audit, and danger zone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot tone="ok" label={data.about.version} />
          <span className="font-mono text-11 text-fg-faint">{data.about.build_id}</span>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <nav className="col-span-3 panel p-2 flex flex-col gap-0.5 self-start">
          {NAV.map((n) => (
            <Link
              key={n.id}
              href={`/settings/${n.id}`}
              aria-current={section === n.id ? "page" : undefined}
              className={cn(
                "h-8 px-2 rounded text-12 flex items-center",
                section === n.id ? "bg-[var(--hover)] text-fg" : "text-fg-muted hover:text-fg hover:bg-[var(--hover-soft)]",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <section className="col-span-9 flex flex-col gap-4">
          {section === "general" && <GeneralSection data={data.general} />}
          {section === "connections" && <ConnectionsSection items={data.connections} />}
          {section === "webhooks" && <WebhooksSection items={data.webhooks} />}
          {section === "tokens" && <TokensSection items={data.tokens} />}
          {section === "members" && <MembersSection items={data.members} />}
          {section === "notifications" && <NotificationsSection items={data.connections} />}
          {section === "prefs" && <PrefsSection prefs={data.prefs} />}
          {section === "audit" && <AuditSection />}
          {section === "about" && (
            <AboutSection about={data.about} workspaceName={data.general.workspace_name} />
          )}
        </section>
      </div>
    </div>
  );
}
