/**
 * Periodic connector sync trigger.
 *
 * Calls the apps/web sync endpoints on a timer. apps/web does the actual
 * work (it owns the connector clients + DB writes); this process is just
 * the scheduler. Skips gracefully if SYNC_SECRET or SYNC_WEB_URL are unset.
 */

const PROXMOX_INTERVAL_MS = 30_000;

export function startSyncTick(): () => void {
  const secret = process.env.SYNC_SECRET;
  const webUrl = process.env.SYNC_WEB_URL ?? "http://127.0.0.1:3000";
  if (!secret) {
    console.warn("[realtime] SYNC_SECRET not set — connector sync tick disabled");
    return () => undefined;
  }

  async function tickProxmox(): Promise<void> {
    try {
      const res = await fetch(`${webUrl}/api/sync/proxmox`, {
        method: "POST",
        headers: { "x-sync-secret": secret! },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        console.warn(`[realtime] proxmox sync HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as { ok?: boolean; skipped?: string; nodes?: number; guests?: number };
      if (body.skipped) {
        // Quiet during the common "not connected" case.
      } else if (body.ok) {
        console.log(`[realtime] proxmox sync ok — ${body.nodes ?? 0} nodes / ${body.guests ?? 0} guests`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[realtime] proxmox sync failed: ${msg}`);
    }
  }

  const timer = setInterval(() => void tickProxmox(), PROXMOX_INTERVAL_MS);
  // Fire once on boot too — useful in dev when the worker comes up after
  // the user has just configured a connection.
  setTimeout(() => void tickProxmox(), 2_000);

  console.log(`[realtime] connector sync tick scheduled every ${PROXMOX_INTERVAL_MS / 1000}s`);
  return () => clearInterval(timer);
}
