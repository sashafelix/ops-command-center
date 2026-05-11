"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { TrpcProvider } from "@/lib/trpc/provider";
import { CommandPaletteProvider } from "@/components/cmdk/command-palette";
import { ReauthGate } from "@/components/reauth/reauth-gate";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TrpcProvider>
        <ReauthGate>
          <CommandPaletteProvider>{children}</CommandPaletteProvider>
        </ReauthGate>
      </TrpcProvider>
    </SessionProvider>
  );
}
