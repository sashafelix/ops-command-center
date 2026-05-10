import Link from "next/link";

export function AuditSection() {
  return (
    <article className="panel p-4">
      <h2 className="text-13 font-semibold text-fg mb-2">Audit log · read-only mirror</h2>
      <p className="text-12 text-fg-muted mb-3">
        The full audit surface lives at <Link href="/audit-log" className="text-info hover:underline">/audit-log</Link>{" "}
        with the client-side chain verifier and CSV / JSONL export. This sub-section exists for
        operators who land in Settings looking for it.
      </p>
      <Link
        href="/audit-log"
        className="h-8 px-3 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg inline-flex items-center"
      >
        Open audit log
      </Link>
    </article>
  );
}
