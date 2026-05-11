"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import type { Seed } from "@/server/mock/seed";

type Prefs = Seed["settings"]["prefs"];

export function PrefsSection({ prefs }: { prefs: Prefs }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const [draft, setDraft] = useState<Prefs>(prefs);
  const [saved, setSaved] = useState<null | Date>(null);

  useEffect(() => setDraft(prefs), [prefs]);

  const m = trpc.settings.savePrefs.useMutation({
    onSuccess: () => {
      setSaved(new Date());
      void utils.settings.overview.invalidate();
    },
  });

  async function save(next: Partial<Prefs>) {
    const merged = { ...draft, ...next };
    setDraft(merged);
    const ok = await requireFreshAuth("Confirm to save workspace preferences.");
    if (!ok) {
      setDraft(prefs);
      return;
    }
    m.mutate(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-13 font-semibold text-fg">Preferences</h2>
        {saved && <SavedHint at={saved} />}
      </header>

      <article className="panel p-4">
        <h3 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-3">Data</h3>
        <Field label="Retention">
          <select
            value={draft.retention}
            onChange={(e) => void save({ retention: e.target.value })}
            className="h-7 px-2 panel2 text-12 text-fg bg-transparent outline-none"
          >
            <option value="30 days">30 days</option>
            <option value="60 days">60 days</option>
            <option value="90 days">90 days</option>
            <option value="180 days">180 days</option>
            <option value="365 days">365 days</option>
          </select>
        </Field>
        <Field label="Timezone">
          <select
            value={draft.timezone}
            onChange={(e) => void save({ timezone: e.target.value })}
            className="h-7 px-2 panel2 text-12 text-fg bg-transparent outline-none"
          >
            <option value="UTC">UTC</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
          </select>
        </Field>
      </article>

      <article className="panel p-4">
        <h3 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-3">Display</h3>
        <Field label="Density">
          <select
            value={draft.density}
            onChange={(e) => void save({ density: e.target.value as Prefs["density"] })}
            className="h-7 px-2 panel2 text-12 text-fg bg-transparent outline-none"
          >
            <option value="compact">compact</option>
            <option value="comfortable">comfortable</option>
          </select>
        </Field>
        <Field label="Theme">
          <select
            value={draft.theme}
            onChange={(e) => void save({ theme: e.target.value as Prefs["theme"] })}
            className="h-7 px-2 panel2 text-12 text-fg bg-transparent outline-none"
          >
            <option value="system">system</option>
            <option value="dark">dark</option>
            <option value="light">light</option>
          </select>
        </Field>
        <Field label="Language">
          <select
            value={draft.language}
            onChange={(e) => void save({ language: e.target.value })}
            className="h-7 px-2 panel2 text-12 text-fg bg-transparent outline-none"
          >
            <option value="en-US">en-US</option>
            <option value="en-GB">en-GB</option>
            <option value="de-DE">de-DE</option>
            <option value="fr-FR">fr-FR</option>
            <option value="ja-JP">ja-JP</option>
          </select>
        </Field>
      </article>

      <article className="panel p-4">
        <h3 className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint mb-3">Behavior</h3>
        <Toggle
          label="Auto refresh"
          checked={draft.auto_refresh}
          onChange={(b) => void save({ auto_refresh: b })}
        />
        <Toggle
          label="Ambient audio cues"
          subtitle="Out of v1; surface lands later"
          checked={draft.ambient_audio}
          onChange={(b) => void save({ ambient_audio: b })}
        />
        <Toggle
          label="Experimental features"
          checked={draft.experimental}
          onChange={(b) => void save({ experimental: b })}
        />
      </article>

      {m.error && <div className="text-11 text-bad">Save failed — {m.error.message}</div>}
    </div>
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

function Toggle({
  label,
  subtitle,
  checked,
  onChange,
}: {
  label: string;
  subtitle?: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="grid grid-cols-3 gap-3 py-2 border-t first:border-t-0 first:pt-0 items-center cursor-pointer">
      <div>
        <span className="text-12 text-fg">{label}</span>
        {subtitle && <div className="text-11 text-fg-faint">{subtitle}</div>}
      </div>
      <div className="col-span-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-info"
        />
      </div>
    </label>
  );
}

function SavedHint({ at }: { at: Date }) {
  const secs = Math.max(0, Math.floor((Date.now() - at.getTime()) / 1000));
  return (
    <span className="text-11 text-ok flex items-center gap-1">
      <Check size={11} aria-hidden /> Saved {secs === 0 ? "just now" : `${secs}s ago`}
    </span>
  );
}
