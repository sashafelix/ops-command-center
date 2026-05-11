import { trpcServer } from "@/lib/trpc/server";
import { BudgetsView } from "./budgets-view";

export const metadata = { title: "Budgets · Ops Command Center" };

export default async function BudgetsPage() {
  const trpc = await trpcServer();
  const initial = await trpc.budgets.overview();
  return <BudgetsView initial={initial} />;
}
