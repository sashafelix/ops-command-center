"use client";

import type { ReactNode } from "react";
import { TrpcProvider } from "@/lib/trpc/provider";
import { CommandPaletteProvider } from "@/components/cmdk/command-palette";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TrpcProvider>
      <CommandPaletteProvider>{children}</CommandPaletteProvider>
    </TrpcProvider>
  );
}
