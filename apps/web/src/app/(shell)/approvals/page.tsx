import { trpcServer } from "@/lib/trpc/server";
import { ApprovalsQueue } from "./approvals-queue";

export const metadata = { title: "Approvals · Ops Command Center" };

export default async function ApprovalsPage() {
  const trpc = await trpcServer();
  const initial = await trpc.approvals.inbox();
  return <ApprovalsQueue initial={initial} />;
}
