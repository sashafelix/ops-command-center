"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./client";

export function TrpcProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Most surface data is read-mostly + refreshed by ingest events.
            // 60s as a floor so revisiting a tab paints from cache.
            staleTime: 60_000,
            // Keep the last successful payload visible while a refetch is
            // in flight — eliminates the skeleton flash on tab switch.
            placeholderData: keepPreviousData,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const [client] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
    }),
  );
  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
