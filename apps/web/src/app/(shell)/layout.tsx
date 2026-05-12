import type { ReactNode } from "react";
import { ChromeShell } from "@/components/shell/chrome-shell";
import { BypassBanner } from "@/components/shell/bypass-banner";

/**
 * Chrome layout — no longer marked `force-dynamic`. The middleware already
 * gates the route; the chrome itself doesn't need per-request data, so the
 * App Router can re-use this RSC tree across client-side navigations.
 *
 * Avatar initials now come from `useSession()` inside <ChromeShell/>, so we
 * skip the server roundtrip that was making every tab switch feel laggy.
 */
export default function ShellLayout({
  children,
  overlay,
}: {
  children: ReactNode;
  overlay: ReactNode;
}) {
  return (
    <>
      <BypassBanner />
      <ChromeShell>
        {children}
        {overlay}
      </ChromeShell>
    </>
  );
}
