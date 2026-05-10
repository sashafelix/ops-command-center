import type { Connection } from "@/server/mock/seed";
import { StatusDot } from "@/components/status-dot";

export function NotificationsSection({ items }: { items: Connection[] }) {
  // Filter to notification-providers (slack, pagerduty, plus a stub for email)
  const channels = items.filter((c) => c.category === "Notifications");
  const events = [
    "session.failed",
    "approval.denied",
    "incident.opened",
    "audit.row",
    "budget.breach",
    "eval.regression",
    "agent.rollback",
  ] as const;

  return (
    <article className="flex flex-col gap-4">
      <h2 className="text-13 font-semibold text-fg">Notifications</h2>

      {/* Channel cards */}
      <section>
        <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Channels
        </div>
        <div className="grid grid-cols-3 gap-3">
          {channels.map((c) => (
            <article key={c.id} className="panel p-3 flex flex-col gap-2">
              <header className="flex items-center gap-2">
                <span className="text-13 text-fg flex-1 truncate">{c.name}</span>
                <StatusDot tone={c.health} label={c.status} />
              </header>
              <div className="text-11 text-fg-muted truncate">{c.detail}</div>
              <div className="text-11 text-fg-faint">last sync · {c.last_sync}</div>
            </article>
          ))}
          <article className="panel p-3 flex flex-col gap-2">
            <header className="flex items-center gap-2">
              <span className="text-13 text-fg flex-1 truncate">Email · ses</span>
              <StatusDot tone="ok" label="connected" />
            </header>
            <div className="text-11 text-fg-muted truncate">noreply@anthropic-ops · 412/24h</div>
            <div className="text-11 text-fg-faint">last sync · 2 min ago</div>
          </article>
        </div>
      </section>

      {/* Event routing matrix */}
      <section>
        <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
          Event routing
        </div>
        <div className="panel overflow-hidden">
          <table className="w-full text-12">
            <thead className="text-fg-faint">
              <tr className="font-mono text-[10.5px] tracking-widest uppercase">
                <th className="text-left px-3 py-2 font-normal">Event</th>
                <th className="text-center px-3 py-2 font-normal w-24">Slack</th>
                <th className="text-center px-3 py-2 font-normal w-24">PagerDuty</th>
                <th className="text-center px-3 py-2 font-normal w-24">Email</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e} className="border-t">
                  <td className="px-3 py-2 font-mono text-fg">{e}</td>
                  <td className="px-3 py-2 text-center">{routedFor(e, "slack") ? "•" : ""}</td>
                  <td className="px-3 py-2 text-center">{routedFor(e, "pd") ? "•" : ""}</td>
                  <td className="px-3 py-2 text-center">{routedFor(e, "email") ? "•" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  );
}

function routedFor(event: string, channel: "slack" | "pd" | "email"): boolean {
  // Static routing matrix; Phase 6 will hook real config
  const matrix: Record<string, Record<string, boolean>> = {
    "session.failed":   { slack: true,  pd: false, email: false },
    "approval.denied":  { slack: true,  pd: false, email: true  },
    "incident.opened":  { slack: true,  pd: true,  email: true  },
    "audit.row":        { slack: false, pd: false, email: false },
    "budget.breach":    { slack: true,  pd: true,  email: true  },
    "eval.regression":  { slack: true,  pd: false, email: false },
    "agent.rollback":   { slack: true,  pd: false, email: true  },
  };
  return matrix[event]?.[channel] ?? false;
}
