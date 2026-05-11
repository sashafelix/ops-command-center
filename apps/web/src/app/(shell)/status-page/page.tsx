import { trpcServer } from "@/lib/trpc/server";
import { StatusPageView } from "./status-page-view";

export const metadata = { title: "Status page · Ops Command Center" };

export default async function StatusPage() {
  const trpc = await trpcServer();
  const initial = await trpc.statusPage.overview({ mode: "internal" });
  return <StatusPageView initial={initial} />;
}
