import { trpcServer } from "@/lib/trpc/server";
import { EvalsView } from "./evals-view";

export const metadata = { title: "Evals · Ops Command Center" };

export default async function EvalsPage() {
  const trpc = await trpcServer();
  const initial = await trpc.evals.overview();
  return <EvalsView initial={initial} />;
}
