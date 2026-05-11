import { trpcServer } from "@/lib/trpc/server";
import { InfraOverview } from "./infra-overview";

export const metadata = { title: "Infra · Ops Command Center" };

export default async function InfraPage() {
  const trpc = await trpcServer();
  const initial = await trpc.infra.overview();
  return <InfraOverview initial={initial} />;
}
