import { AlertTriangle } from "lucide-react";

/**
 * Persistent warning when ALLOW_DEV_BYPASS=1 is active on a production build.
 *
 * Renders server-side from process.env so there's no client/server skew and
 * no extra round-trip. Hidden when:
 *   - NODE_ENV=development (the dev login is the default and obvious)
 *   - ALLOW_DEV_BYPASS is unset (real auth is in place)
 *
 * The banner intentionally takes vertical space so an operator can't miss
 * that they're running an unauthenticated workspace.
 */
export function BypassBanner() {
  const isDev = process.env.NODE_ENV === "development";
  const allowBypass = process.env.ALLOW_DEV_BYPASS === "1";

  if (isDev || !allowBypass) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b bg-warn/10 px-4 py-2 flex items-center gap-3 text-12 text-fg"
    >
      <AlertTriangle size={14} className="text-warn" aria-hidden />
      <span className="text-warn font-mono uppercase tracking-widest text-[10.5px]">
        Auth bypass active
      </span>
      <span className="text-fg-muted">
        <span className="font-mono">ALLOW_DEV_BYPASS=1</span> — anyone reachable can sign in as
        any role. Disable + configure Google OIDC before exposing this publicly.
      </span>
    </div>
  );
}
