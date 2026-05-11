/**
 * Navigation loading state for every (shell) route. Shows while the route's
 * server payload is being fetched + while the JS bundle is parsing on first
 * hit in dev mode. Renders a four-up skeleton row + a wide skeleton so the
 * user sees structure immediately rather than the previous page sitting
 * still or a blank panel.
 */
export default function ShellLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 panel skel" aria-hidden />
      <div className="grid grid-cols-4 gap-3">
        <div className="h-24 panel skel" aria-hidden />
        <div className="h-24 panel skel" aria-hidden />
        <div className="h-24 panel skel" aria-hidden />
        <div className="h-24 panel skel" aria-hidden />
      </div>
      <div className="h-64 panel skel" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
