"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { NowPlaying } from "./now-playing";
import { RuntimeBanner } from "./runtime-banner";
import { suppressNowPlaying } from "./nav-config";

export function ChromeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const showNowPlaying = !suppressNowPlaying(pathname);

  return (
    <div className="min-w-[1280px]">
      <TopBar />
      <RuntimeBanner />
      <div className="flex">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          {showNowPlaying && <NowPlaying />}
          <main className="flex-1 min-w-0">
            <div className="mx-auto max-w-content px-8 py-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
