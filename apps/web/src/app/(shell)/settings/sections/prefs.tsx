import type { Seed } from "@/server/mock/seed";

export function PrefsSection({ prefs }: { prefs: Seed["settings"]["prefs"] }) {
  return (
    <div className="flex flex-col gap-4">
      <article className="panel p-4">
        <h2 className="text-13 font-semibold text-fg mb-3">Data</h2>
        <Field label="Retention" value={prefs.retention} />
        <Field label="Timezone" value={prefs.timezone} />
      </article>

      <article className="panel p-4">
        <h2 className="text-13 font-semibold text-fg mb-3">Display</h2>
        <Field label="Density" value={prefs.density} />
        <Field label="Theme" value={prefs.theme} />
        <Field label="Language" value={prefs.language} />
      </article>

      <article className="panel p-4">
        <h2 className="text-13 font-semibold text-fg mb-3">Behavior</h2>
        <Field label="Auto refresh" value={prefs.auto_refresh ? "on" : "off"} />
        <Field label="Ambient audio" value={prefs.ambient_audio ? "on" : "off (out of v1)"} />
        <Field label="Experimental features" value={prefs.experimental ? "on" : "off"} />
      </article>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-t first:border-t-0 first:pt-0">
      <span className="text-12 text-fg-muted">{label}</span>
      <span className="col-span-2 text-12 text-fg">{value}</span>
    </div>
  );
}
