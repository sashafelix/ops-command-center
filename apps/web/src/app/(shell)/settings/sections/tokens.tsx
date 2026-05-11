"use client";

import { Key, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import type { TokenRow } from "@/server/mock/seed";

export function TokensSection({ items }: { items: TokenRow[] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const revoke = trpc.settings.revokeToken.useMutation({
    onSuccess: () => void utils.settings.overview.invalidate(),
  });

  async function onRevoke(id: string, name: string) {
    const ok = await requireFreshAuth(`Revoke token "${name}". This cannot be undone.`);
    if (!ok) return;
    revoke.mutate({ id });
  }

  return (
    <article>
      <h2 className="text-13 font-semibold text-fg mb-3">API tokens</h2>
      <div className="panel overflow-hidden">
        <table className="w-full text-12">
          <thead className="text-fg-faint">
            <tr className="font-mono text-[10.5px] tracking-widest uppercase">
              <th className="text-left px-3 py-2 font-normal w-44">Name</th>
              <th className="text-left px-3 py-2 font-normal">Scope</th>
              <th className="text-left px-3 py-2 font-normal w-24">Created</th>
              <th className="text-left px-3 py-2 font-normal w-24">Last used</th>
              <th className="text-left px-3 py-2 font-normal w-24">Expires</th>
              <th className="text-right px-3 py-2 font-normal w-12" />
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-t hover:bg-[var(--hover-soft)]">
                <td className="px-3 py-2 flex items-center gap-2">
                  <Key size={11} className="text-fg-faint" aria-hidden />
                  <span className="text-fg">{t.name}</span>
                </td>
                <td className="px-3 py-2 font-mono text-fg-muted truncate">{t.scope}</td>
                <td className="px-3 py-2 text-fg-muted">{t.created_at}</td>
                <td className="px-3 py-2 text-fg-muted">{t.last_used}</td>
                <td className="px-3 py-2 text-fg-muted">{t.expires_at}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => void onRevoke(t.id, t.name)}
                    className="text-fg-faint hover:text-bad"
                    aria-label={`Revoke ${t.name}`}
                    title="Revoke token"
                  >
                    <Trash2 size={11} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
