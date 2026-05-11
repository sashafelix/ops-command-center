import { trpcServer } from "@/lib/trpc/server";
import { SessionsList } from "./sessions-list";

export const metadata = { title: "Sessions · Ops Command Center" };

export default async function SessionsPage() {
  const trpc = await trpcServer();
  const initial = await trpc.sessions.list();
  return <SessionsList initial={initial} />;
}
