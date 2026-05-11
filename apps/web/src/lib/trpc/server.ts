import "server-only";
import { cache } from "react";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/context";

/**
 * Server-side tRPC caller for use inside React Server Components.
 *
 * Pages call `const trpc = await trpcServer()` and then `await trpc.live.kpi()`
 * to read data during SSR. Combined with `initialData` on the client-side
 * useQuery, this eliminates the post-hydration round-trip — the HTML ships
 * with the data already in it.
 *
 * `cache()` dedupes calls within a single render: hitting `trpcServer()`
 * twice from sibling components reuses the same context + caller.
 */
const createCaller = createCallerFactory(appRouter);

export const trpcServer = cache(async () => {
  const ctx = await createContext();
  return createCaller(ctx);
});
