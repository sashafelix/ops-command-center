import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Audit log · Ops Command Center" };

export default function AuditLogPage() {
  return (
    <Placeholder
      title="Audit log"
      blurb="Append-only hash-chained event log; client-side chain verifier — Phase 4."
      empty="Audit log ships in Phase 4."
    />
  );
}
