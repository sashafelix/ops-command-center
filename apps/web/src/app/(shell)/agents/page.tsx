import { trpcServer } from "@/lib/trpc/server";
import { AgentsRegistry } from "./agents-registry";

export const metadata = { title: "Agents · Ops Command Center" };

export default async function AgentsPage() {
  const trpc = await trpcServer();
  const initial = await trpc.agents.overview();
  return <AgentsRegistry initial={initial} />;
}
