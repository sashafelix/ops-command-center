/**
 * Sync the Proxmox cluster into the regions + services tables.
 *
 * Auth: shared-secret header. The realtime worker calls this on a timer
 * with `X-Sync-Secret: ${SYNC_SECRET}`. Header doesn't go through normal
 * session auth — this endpoint runs as a workspace-internal sync.
 *
 * Behavior:
 *   1. Load the proxmox connection row.
 *   2. If status !== "connected", return { skipped: "not connected" }.
 *   3. Pull the cluster via getCluster().
 *   4. Replace regions (one per node) + services (one per running VM/LXC)
 *      in a single transaction.
 *   5. NOTIFY ops_event so the live dashboard refetches.
 */

import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getCluster } from "@/server/connectors/proxmox";
import { notify } from "@/server/pg-notify";
import type { Connection } from "@/server/mock/seed";

export async function POST(req: Request) {
  const secret = req.headers.get("x-sync-secret") ?? "";
  const expected = process.env.SYNC_SECRET ?? "";
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.id, "proxmox"));
  if (!row) {
    return NextResponse.json({ skipped: "no_proxmox_connection" });
  }
  if (row.status !== "connected") {
    return NextResponse.json({ skipped: `status=${row.status}` });
  }

  const conn: Connection = {
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status as Connection["status"],
    detail: row.detail,
    fields: row.fields,
    last_sync: row.last_sync,
    health: row.health,
  };

  const cluster = await getCluster(conn);
  if (!cluster.ok) {
    await db
      .update(schema.connections)
      .set({ health: "bad", detail: `sync · ${cluster.reason}` })
      .where(eq(schema.connections.id, "proxmox"));
    return NextResponse.json({ ok: false, reason: cluster.reason }, { status: 502 });
  }

  await db.transaction(async (tx) => {
    // Replace the region + service tables wholesale. We tagged Proxmox rows
    // with `pve_` prefixes so this only clobbers Proxmox-sourced data.
    await tx.execute(sql`DELETE FROM regions WHERE id LIKE 'pve-%'`);
    await tx.execute(sql`DELETE FROM services WHERE id LIKE 'pve-%' OR id LIKE 'qemu-%' OR id LIKE 'lxc-%'`);

    for (const n of cluster.nodes) {
      await tx.insert(schema.regions).values({
        id: n.id,
        name: n.node,
        status: n.status === "online" ? "ok" : "bad",
        nodes: `${n.status === "online" ? 1 : 0}/1`,
        az: 1,
        cost_per_hour: "—",
        traffic_pct: 0,
      });
    }

    for (const g of cluster.guests) {
      const cpuPct = g.cpu_pct;
      const memPct = g.mem_pct;
      const overloaded = cpuPct > 0.85 || memPct > 0.85;
      await tx.insert(schema.services).values({
        id: g.id,
        name: g.name,
        stack: g.kind,
        region: g.node,
        replicas: g.status === "running" ? "1/1" : "0/1",
        cpu_pct: cpuPct,
        mem_pct: memPct,
        rps: 0,
        error_pct: 0,
        p95_ms: 0,
        status: g.status === "running" ? (overloaded ? "warn" : "ok") : "bad",
        reason: g.status !== "running" ? `guest is ${g.status}` : overloaded ? "cpu or memory over 85%" : null,
        version: g.kind === "qemu" ? "qemu" : "lxc",
      });
    }
  });

  await db
    .update(schema.connections)
    .set({ health: "ok", last_sync: "just now" })
    .where(eq(schema.connections.id, "proxmox"));

  // Signal subscribers to refetch infra
  await notify("sessions", { kind: "infra.refresh", source: "proxmox" });

  return NextResponse.json({
    ok: true,
    nodes: cluster.nodes.length,
    guests: cluster.guests.length,
  });
}
