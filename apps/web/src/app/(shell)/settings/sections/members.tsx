"use client";

import { useState } from "react";
import { ShieldCheck, ShieldAlert, Trash2, Plus, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import type { MemberRow } from "@/server/mock/seed";

const ROLES: MemberRow["role"][] = ["Owner", "Admin", "SRE", "Analyst", "Viewer"];

export function MembersSection({ items }: { items: MemberRow[] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const [open, setOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRow["role"]>("Viewer");

  const setRole = trpc.settings.setMemberRole.useMutation({
    onSuccess: () => void utils.settings.overview.invalidate(),
  });
  const remove = trpc.settings.removeMember.useMutation({
    onSuccess: () => void utils.settings.overview.invalidate(),
  });
  const invite = trpc.settings.inviteMember.useMutation({
    onSuccess: () => {
      setOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("Viewer");
      void utils.settings.overview.invalidate();
    },
  });

  async function onChangeRole(id: string, role: MemberRow["role"]) {
    const ok = await requireFreshAuth(`Change role for ${id} to ${role}.`);
    if (!ok) return;
    setRole.mutate({ id, role });
  }

  async function onRemove(id: string, name: string) {
    const ok = await requireFreshAuth(`Remove ${name} from the workspace.`);
    if (!ok) return;
    remove.mutate({ id });
  }

  async function onInvite() {
    const ok = await requireFreshAuth(`Invite ${inviteEmail} as ${inviteRole}.`);
    if (!ok) return;
    invite.mutate({ name: inviteName, email: inviteEmail, role: inviteRole });
  }

  return (
    <article>
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-13 font-semibold text-fg">Members</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5"
        >
          <Plus size={12} aria-hidden /> Invite member
        </button>
      </header>

      <div className="panel overflow-hidden">
        <table className="w-full text-12">
          <thead className="text-fg-faint">
            <tr className="font-mono text-[10.5px] tracking-widest uppercase">
              <th className="text-left px-3 py-2 font-normal w-12" />
              <th className="text-left px-3 py-2 font-normal">Name</th>
              <th className="text-left px-3 py-2 font-normal">Email</th>
              <th className="text-left px-3 py-2 font-normal w-28">Role</th>
              <th className="text-left px-3 py-2 font-normal w-16">MFA</th>
              <th className="text-left px-3 py-2 font-normal w-32">Last seen</th>
              <th className="text-right px-3 py-2 font-normal w-12" />
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-t hover:bg-[var(--hover-soft)]">
                <td className="px-3 py-2">
                  <span className="w-7 h-7 rounded-full bg-ink-3 border flex items-center justify-center font-mono text-10 text-fg">
                    {m.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                  </span>
                </td>
                <td className="px-3 py-2 text-fg">{m.name}</td>
                <td className="px-3 py-2 font-mono text-fg-muted">{m.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={m.role}
                    onChange={(e) => void onChangeRole(m.id, e.target.value as MemberRow["role"])}
                    disabled={m.role === "Owner"}
                    className="h-6 px-1 panel2 text-11 text-fg bg-transparent outline-none disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {m.mfa ? (
                    <ShieldCheck size={12} className="text-ok" aria-label="MFA enabled" />
                  ) : (
                    <ShieldAlert size={12} className="text-warn" aria-label="MFA missing" />
                  )}
                </td>
                <td className="px-3 py-2 text-fg-muted">{m.last_seen}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => void onRemove(m.id, m.name)}
                    disabled={m.role === "Owner"}
                    className="text-fg-faint hover:text-bad disabled:opacity-30"
                    aria-label={`Remove ${m.name}`}
                  >
                    <Trash2 size={11} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invite member"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden onClick={() => setOpen(false)} />
          <div className="relative panel w-full max-w-sm p-5 animate-appear">
            <header className="flex items-center justify-between mb-3">
              <h3 className="text-13 font-semibold text-fg">Invite member</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center text-fg-muted hover:text-fg"
                aria-label="Close"
              >
                <X size={14} aria-hidden />
              </button>
            </header>

            <label className="block text-11 text-fg-muted mb-1">Name</label>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full h-9 panel2 bg-transparent px-3 text-12 text-fg outline-none mb-3"
            />
            <label className="block text-11 text-fg-muted mb-1">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="jane@ops"
              className="w-full h-9 panel2 bg-transparent px-3 text-12 text-fg outline-none mb-3"
            />
            <label className="block text-11 text-fg-muted mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MemberRow["role"])}
              className="w-full h-9 panel2 bg-transparent px-3 text-12 text-fg outline-none mb-4"
            >
              {ROLES.filter((r) => r !== "Owner").map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <footer className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 px-3 panel2 text-12 text-fg-muted hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onInvite()}
                disabled={
                  invite.isPending || inviteName.length < 1 || !/.+@.+/.test(inviteEmail)
                }
                className="h-8 px-3 ml-auto panel2 hover:border-line2 text-12 text-fg disabled:opacity-50"
              >
                Send invite
              </button>
            </footer>
            {invite.error && (
              <p className="text-11 text-bad mt-2">Invite failed — {invite.error.message}</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
