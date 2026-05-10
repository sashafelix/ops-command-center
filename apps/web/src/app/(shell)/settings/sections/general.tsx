export function GeneralSection({
  data,
}: {
  data: { workspace_name: string; org_id: string; created_at: string; tier: string };
}) {
  return (
    <article className="panel p-4">
      <h2 className="text-13 font-semibold text-fg mb-3">General</h2>
      <Field label="Workspace name" value={data.workspace_name} />
      <Field label="Org ID" value={data.org_id} mono />
      <Field label="Created" value={data.created_at} />
      <Field label="Tier" value={data.tier} />
    </article>
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
