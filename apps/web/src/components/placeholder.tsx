import type { ReactNode } from "react";

/**
 * Placeholder for Phase 2+ surfaces. Renders a header, four KPI skeletons, and
 * an empty-state strip with a personality line per HANDOFF §3.
 */
export function Placeholder({
  title,
  blurb,
  empty,
  children,
}: {
  title: string;
  blurb?: string;
  empty?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-fg text-13 font-semibold tracking-tight">{title}</h1>
          {blurb && <p className="text-12 text-fg-muted mt-1">{blurb}</p>}
        </div>
        <span className="font-mono text-11 text-fg-faint">phase 1 · scaffold</span>
      </header>

      <div className="grid grid-cols-4 gap-3">
        <div className="h-24 panel skel" aria-hidden />
        <div className="h-24 panel skel" aria-hidden />
        <div className="h-24 panel skel" aria-hidden />
        <div className="h-24 panel skel" aria-hidden />
      </div>

      <section className="panel p-8 text-center">
        <div className="ascii mb-3" style={{ lineHeight: 1.05 }}>
          {`  ___       _   _    _   _  _  _ \n / _ \\ _ __| |_| |  | | | || \\| |\n| (_) | '_ \\  _| |__| |_| || .\` |\n \\___/| .__/\\__|____/\\___/ |_|\\_|\n      |_|                       `}
        </div>
        <div className="text-13 text-fg">{empty ?? "Surface lands in a later phase."}</div>
        <div className="text-12 text-fg-muted mt-1">Stay paranoid.</div>
      </section>

      {children}
    </div>
  );
}
