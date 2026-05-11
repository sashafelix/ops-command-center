import { trpcServer } from "@/lib/trpc/server";
import { TrustView } from "./trust-view";

export const metadata = { title: "Trust · Ops Command Center" };

export default async function TrustPage() {
  const trpc = await trpcServer();
  const initial = await trpc.trust.overview();
  return <TrustView initial={initial} />;
}
