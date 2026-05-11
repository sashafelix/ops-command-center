import { trpcServer } from "@/lib/trpc/server";
import { AuditLogView } from "./audit-log-view";

export const metadata = { title: "Audit log · Ops Command Center" };

export default async function AuditLogPage() {
  const trpc = await trpcServer();
  // Server-fetch the cheap pieces. The heavy `chain` query (~400 KB / 1200
  // rows) is intentionally deferred until the user clicks "Verify".
  const [kpi, facets, list] = await Promise.all([
    trpc.auditLog.kpi(),
    trpc.auditLog.facets(),
    trpc.auditLog.list({ limit: 500, offset: 0 }),
  ]);
  return <AuditLogView initialKpi={kpi} initialFacets={facets} initialList={list} />;
}
