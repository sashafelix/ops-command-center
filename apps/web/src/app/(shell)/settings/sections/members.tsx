import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { MemberRow } from "@/server/mock/seed";

const ROLE_TONE: Record<MemberRow["role"], string> = {
  Owner: "violet",
  Admin: "info",
  SRE: "ok",
  Analyst: "ok",
  Viewer: "ok",
};

export function MembersSection({ items }: { items: MemberRow[] }) {
  return (
    <article>
      <h2 className="text-13 font-semibold text-fg mb-3">Members</h2>
      <div className="panel overflow-hidden">
        <table className="w-full text-12">
          <thead className="text-fg-faint">
            <tr className="font-mono text-[10.5px] tracking-widest uppercase">
              <th className="text-left px-3 py-2 font-normal w-12" />
              <th className="text-left px-3 py-2 font-normal">Name</th>
              <th className="text-left px-3 py-2 font-normal">Email</th>
              <th className="text-left px-3 py-2 font-normal w-24">Role</th>
              <th className="text-left px-3 py-2 font-normal w-16">MFA</th>
              <th className="text-left px-3 py-2 font-normal w-32">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-t hover:bg-white/[0.02]">
                <td className="px-3 py-2">
                  <span className="w-7 h-7 rounded-full bg-ink-3 border flex items-center justify-center font-mono text-10 text-fg">
                    {m.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                  </span>
                </td>
                <td className="px-3 py-2 text-fg">{m.name}</td>
                <td className="px-3 py-2 font-mono text-fg-muted">{m.email}</td>
                <td className="px-3 py-2">
                  <span className={`chip text-${ROLE_TONE[m.role]}`}>{m.role}</span>
                </td>
                <td className="px-3 py-2">
                  {m.mfa ? (
                    <ShieldCheck size={12} className="text-ok" aria-label="MFA enabled" />
                  ) : (
                    <ShieldAlert size={12} className="text-warn" aria-label="MFA missing" />
                  )}
                </td>
                <td className="px-3 py-2 text-fg-muted">{m.last_seen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
