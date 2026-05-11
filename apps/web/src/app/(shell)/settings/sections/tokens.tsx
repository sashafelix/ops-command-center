"use client";

import { useState } from "react";
import { Key, Plus, Copy, X, ShieldCheck, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import type { TokenRow } from "@/server/mock/seed";

const SCOPES = [
  "sessions.write",
  "sessions.read",
  "approvals.write",
  "approvals.read",
  "tool-calls.write",
  "audit.read",
] as const;

export function TokensSection({ items }: { items: TokenRow[] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ secret: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["sessions.write"]);

  const create = trpc.settings.createToken.useMutation({
    onSuccess: (r) => {
      setCreated({ secret: r.secret, name: r.token.name });
      void utils.settings.overview.invalidate();
      setName("");
    },
  });
  const revoke = trpc.settings.revokeToken.useMutation({
    onSuccess: () => void utils.settings.overview.invalidate(),
  });

  async function submitCreate() {
    const ok = await requireFreshAuth(`Create API token "${name}".`);
    if (!ok) return;
    create.mutate({ name, scopes: scopes as (typeof SCOPES)[number][] });
  }

  async function onRevoke(id: string, n: string) {
    const ok = await requireFreshAuth(`Revoke token "${n}". This cannot be undone.`);
    if (!ok) return;
    revoke.mutate({ id });
  }

  return (
    <article>
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-13 font-semibold text-fg">API tokens</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5"
        >
          <Plus size={12} aria-hidden /> New token
        </button>
      </header>

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

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create API token"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden onClick={() => setOpen(false)} />
          <div className="relative panel w-full max-w-md p-5 animate-appear">
            <header className="flex items-center justify-between mb-3">
              <h3 className="text-13 font-semibold text-fg">New API token</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center text-fg-muted hover:text-fg"
                aria-label="Close"
              >
                <X size={14} aria-hidden />
              </button>
            </header>

            {created ? (
              <RevealedSecret
                name={created.name}
                secret={created.secret}
                onClose={() => {
                  setCreated(null);
                  setOpen(false);
                }}
              />
            ) : (
              <>
                <label className="block text-11 text-fg-muted mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ci-deploy"
                  className="w-full h-9 panel2 bg-transparent px-3 text-12 text-fg outline-none mb-3"
                />

                <div className="text-11 text-fg-muted mb-1">Scopes</div>
                <div className="flex flex-col gap-1 mb-4">
                  {SCOPES.map((s) => {
                    const on = scopes.includes(s);
                    return (
                      <label key={s} className="flex items-center gap-2 text-12 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setScopes((cur) =>
                              e.target.checked ? Array.from(new Set([...cur, s])) : cur.filter((x) => x !== s),
                            )
                          }
                          className="accent-info"
                        />
                        <span className="font-mono text-fg">{s}</span>
                      </label>
                    );
                  })}
                </div>

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
                    disabled={create.isPending || name.length < 2 || scopes.length === 0}
                    onClick={() => void submitCreate()}
                    className="h-8 px-3 ml-auto panel2 hover:border-line2 text-12 text-fg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <ShieldCheck size={12} aria-hidden /> Create
                  </button>
                </footer>
                {create.error && (
                  <p className="text-11 text-bad mt-2">Could not create — {create.error.message}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function RevealedSecret({
  name,
  secret,
  onClose,
}: {
  name: string;
  secret: string;
  onClose: () => void;
}) {
  return (
    <>
      <p className="text-12 text-fg mb-2">
        <span className="font-semibold">{name}</span> created. Copy the secret now — you
        won&apos;t see it again.
      </p>
      <div className="panel2 px-3 py-2 font-mono text-12 text-fg break-all flex items-center gap-2 mb-4">
        <span className="flex-1 select-all">{secret}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(secret);
          }}
          className="text-fg-muted hover:text-fg"
          aria-label="Copy secret"
        >
          <Copy size={12} aria-hidden />
        </button>
      </div>
      <footer className="flex items-center">
        <button
          type="button"
          onClick={onClose}
          className="h-8 px-3 ml-auto panel2 hover:border-line2 text-12 text-fg"
        >
          Done
        </button>
      </footer>
    </>
  );
}
