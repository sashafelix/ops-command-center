import { AlertTriangle } from "lucide-react";
import type { Seed } from "@/server/mock/seed";

export function AboutSection({ about }: { about: Seed["settings"]["about"] }) {
  return (
    <div className="flex flex-col gap-4">
      <article className="panel p-4">
        <h2 className="text-13 font-semibold text-fg mb-3">Build</h2>
        <Field label="Version" value={about.version} mono />
        <Field label="Build id" value={about.build_id} mono />
        <Field label="Commit" value={about.commit} mono />
        <Field label="Built at" value={about.built_at} mono />
      </article>

      <article className="panel p-4 border-bad/30" style={{ borderColor: "rgb(var(--bad) / 0.30)" }}>
        <h2 className="text-13 font-semibold text-bad mb-3 flex items-center gap-2">
          <AlertTriangle size={14} aria-hidden /> Danger zone
        </h2>
        <DangerRow
          title="Pause all agents"
          subtitle="Broadcasts a global pause via the agent runtime. Re-auth + audit-event."
          action="Pause"
        />
        <DangerRow
          title="Reset preferences"
          subtitle="Drops all per-user prefs to defaults. Audit-event."
          action="Reset"
        />
        <DangerRow
          title="Delete workspace"
          subtitle="Permanently deletes this workspace and all data. Re-auth + multi-step confirm."
          action="Delete"
          severe
        />
      </article>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-t first:border-t-0 first:pt-0">
      <span className="text-12 text-fg-muted">{label}</span>
      <span className={`col-span-2 text-12 text-fg ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function DangerRow({
  title,
  subtitle,
  action,
  severe,
}: {
  title: string;
  subtitle: string;
  action: string;
  severe?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 py-3 border-t first:border-t-0 first:pt-0 items-center">
      <div className="col-span-2">
        <div className="text-12 text-fg">{title}</div>
        <div className="text-11 text-fg-muted">{subtitle}</div>
      </div>
      <div className="text-right">
        <button
          type="button"
          className={`h-8 px-3 panel2 text-12 ${severe ? "text-bad hover:border-bad/40" : "text-warn hover:border-warn/40"}`}
        >
          {action}
        </button>
      </div>
    </div>
  );
}
