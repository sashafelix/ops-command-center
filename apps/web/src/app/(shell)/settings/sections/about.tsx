import type { Seed } from "@/server/mock/seed";
import { DangerZone } from "./danger-zone";

export function AboutSection({
  about,
  workspaceName,
}: {
  about: Seed["settings"]["about"];
  workspaceName: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <article className="panel p-4">
        <h2 className="text-13 font-semibold text-fg mb-3">Build</h2>
        <Field label="Version" value={about.version} mono />
        <Field label="Build id" value={about.build_id} mono />
        <Field label="Commit" value={about.commit} mono />
        <Field label="Built at" value={about.built_at} mono />
      </article>

      <DangerZone workspaceName={workspaceName} />
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
