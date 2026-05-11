import { trpcServer } from "@/lib/trpc/server";
import { ReportsView } from "./reports-view";

export const metadata = { title: "Reports · Ops Command Center" };

export default async function ReportsPage() {
  const trpc = await trpcServer();
  const initial = await trpc.reports.overview();
  return <ReportsView initial={initial} />;
}
