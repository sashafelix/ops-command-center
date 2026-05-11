"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";

type General = { workspace_name: string; org_id: string; created_at: string; tier: string };

export function GeneralSection({ data }: { data: General }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const [workspaceName, setWorkspaceName] = useState(data.workspace_name);
  const [tier, setTier] = useState(data.tier);
  const [saved, setSaved] = useState<null | Date>(null);

  useEffect(() => {
    setWorkspaceName(data.workspace_name);
    setTier(data.tier);
  }, [data]);

  const m = trpc.settings.saveGeneral.useMutation({
    onSuccess: () => {
      setSaved(new Date());
      void utils.settings.overview.invalidate();
    },
  });

  const dirty = workspaceName !== data.workspace_name || tier !== data.tier;

  async function save() {
    const ok = await requireFreshAuth("Confirm to save workspace details.");
    if (!ok) return;
    m.mutate({ workspace_name: workspaceName, tier });
  }

  return (
    <article className="panel p-4">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-13 font-semibold text-fg">General</h2>
        {saved && (
          <span className="text-11 text-ok flex items-center gap-1">
            <Check size={11} aria-hidden /> Saved
          </span>
        )}
      </header>

      <Field label="Workspace name">
        <input
          type="text"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          className="h-7 px-2 panel2 text-12 text-fg bg-transparent outline-none w-full max-w-sm"
        />
      </Field>
      <Field label="Org ID">
        <span className="font-mono text-12 text-fg-muted">{data.org_id}</span>
      </Field>
      <Field label="Created">
        <span className="text-12 text-fg-muted">{data.created_at}</span>
      </Field>
      <Field label="Tier">
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="h-7 px-2 panel2 text-12 text-fg bg-transparent outline-none"
        >
          <option value="Free">Free</option>
          <option value="Team">Team</option>
          <option value="Enterprise">Enterprise</option>
        </select>
      </Field>

      <footer className="flex items-center gap-2 mt-3 pt-3 border-t">
        <button
          type="button"
          disabled={!dirty || m.isPending}
          onClick={() => void save()}
          className="h-8 px-3 panel2 hover:border-line2 text-12 text-fg disabled:opacity-40"
        >
          Save changes
        </button>
        {m.error && <span className="text-11 text-bad">Save failed — {m.error.message}</span>}
      </footer>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-t first:border-t-0 first:pt-0 items-center">
      <span className="text-12 text-fg-muted">{label}</span>
      <div className="col-span-2">{children}</div>
    </div>
  );
}
