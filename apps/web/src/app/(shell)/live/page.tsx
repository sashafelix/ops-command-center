import { trpcServer } from "@/lib/trpc/server";
import { LiveBoard } from "./live-board";

export const metadata = { title: "Live · Ops Command Center" };

export default async function LivePage() {
  const trpc = await trpcServer();
  // Fetch in parallel during SSR so the HTML ships with the cards filled in;
  // the client mirrors via initialData and refetches on its own staleTime.
  const [kpi, board] = await Promise.all([trpc.live.kpi(), trpc.sessions.liveBoard()]);
  return <LiveBoard initialKpi={kpi} initialBoard={board} />;
}
