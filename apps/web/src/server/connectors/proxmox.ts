import { resolveSecret } from "./secrets";
import { fieldValue, type Connector, type ConnectorTest } from "./types";
import type { Connection } from "@/server/mock/seed";

/**
 * Proxmox VE API client.
 *
 * Auth options:
 *   - API token: header `Authorization: PVEAPIToken=USER@REALM!TOKENID=SECRET`
 *     (preferred, what real ops setups use)
 *   - Ticket / CSRF (cookie-based, for shorter-lived sessions)
 *
 * For the connection card we accept three fields:
 *   - host        e.g. https://pve.internal:8006
 *   - token_id    e.g. ops@pve!ops-readonly
 *   - token       env:PROXMOX_TOKEN (the secret half)
 *
 * Default behavior: ignore TLS cert (env knob), because many Proxmox setups
 * use a self-signed cert. Production should set PROXMOX_VERIFY_TLS=1.
 */

const DEFAULT_PORT = "8006";

type ClusterNode = {
  id: string;
  /** Node name as Proxmox reports it. */
  node: string;
  status: "online" | "offline" | "unknown";
  cpu_pct: number; // 0..1
  mem_pct: number; // 0..1
  maxcpu: number;
  uptime_s: number;
};

type Guest = {
  id: string;
  /** `qemu` (VM) or `lxc` (container). */
  kind: "qemu" | "lxc";
  vmid: number;
  name: string;
  node: string;
  status: "running" | "stopped" | "paused" | "suspended" | "unknown";
  cpu_pct: number;
  mem_pct: number;
  uptime_s: number;
};

export const proxmoxConnector: Connector = {
  id: "proxmox",
  name: "Proxmox VE",
  category: "Infrastructure",
  requiredFieldKeys: ["host", "token_id", "token"],
  defaultFields() {
    return [
      { k: "host", label: "Host", type: "url", value: "" },
      { k: "token_id", label: "Token ID", type: "string", value: "" },
      { k: "token", label: "Token", type: "secret", value: "env:PROXMOX_TOKEN" },
    ];
  },
  async test(c: Connection): Promise<ConnectorTest> {
    const auth = buildAuthHeader(c);
    if (!auth.ok) return { ok: false, reason: auth.reason };
    const host = pveHost(c);
    try {
      const res = await fetch(`${host}/api2/json/version`, {
        headers: { Authorization: auth.value },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status} from ${host}/api2/json/version` };
      const body = (await res.json()) as { data?: { version?: string; release?: string } };
      const v = body.data?.version ?? "?";
      return { ok: true, detail: `PVE ${v} reachable` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }
  },
};

/** Pull cluster nodes + guests in one round-trip-per-node. */
export async function getCluster(
  c: Connection,
): Promise<{ ok: true; nodes: ClusterNode[]; guests: Guest[] } | { ok: false; reason: string }> {
  const auth = buildAuthHeader(c);
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const host = pveHost(c);
  const headers = { Authorization: auth.value };

  try {
    const nodesRes = await fetch(`${host}/api2/json/nodes`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!nodesRes.ok) return { ok: false, reason: `nodes HTTP ${nodesRes.status}` };
    const nodesBody = (await nodesRes.json()) as { data?: RawNode[] };
    const nodes = (nodesBody.data ?? []).map(toClusterNode);

    // Per-node, fetch qemu + lxc lists in parallel.
    const guestArrays = await Promise.all(
      nodes.map(async (n) => {
        const [qemuRes, lxcRes] = await Promise.all([
          fetch(`${host}/api2/json/nodes/${n.node}/qemu`, { headers, signal: AbortSignal.timeout(10_000) }),
          fetch(`${host}/api2/json/nodes/${n.node}/lxc`, { headers, signal: AbortSignal.timeout(10_000) }),
        ]);
        const qemu = qemuRes.ok ? ((await qemuRes.json()) as { data?: RawGuest[] }).data ?? [] : [];
        const lxc = lxcRes.ok ? ((await lxcRes.json()) as { data?: RawGuest[] }).data ?? [] : [];
        return [
          ...qemu.map((g) => toGuest(g, "qemu", n.node)),
          ...lxc.map((g) => toGuest(g, "lxc", n.node)),
        ];
      }),
    );
    const guests = guestArrays.flat();
    return { ok: true, nodes, guests };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}

// --- internals ---

type RawNode = {
  node: string;
  status?: string;
  cpu?: number; // 0..1
  mem?: number;
  maxmem?: number;
  maxcpu?: number;
  uptime?: number;
};
type RawGuest = {
  vmid: number;
  name?: string;
  status?: string;
  cpu?: number;
  mem?: number;
  maxmem?: number;
  uptime?: number;
};

function toClusterNode(r: RawNode): ClusterNode {
  return {
    id: `pve-${r.node}`,
    node: r.node,
    status: r.status === "online" ? "online" : r.status === "offline" ? "offline" : "unknown",
    cpu_pct: clamp01(r.cpu ?? 0),
    mem_pct: r.maxmem && r.maxmem > 0 ? clamp01((r.mem ?? 0) / r.maxmem) : 0,
    maxcpu: r.maxcpu ?? 0,
    uptime_s: r.uptime ?? 0,
  };
}

function toGuest(r: RawGuest, kind: "qemu" | "lxc", node: string): Guest {
  return {
    id: `${kind}-${r.vmid}`,
    kind,
    vmid: r.vmid,
    name: r.name ?? `${kind}-${r.vmid}`,
    node,
    status:
      r.status === "running" ? "running"
      : r.status === "stopped" ? "stopped"
      : r.status === "paused" ? "paused"
      : r.status === "suspended" ? "suspended"
      : "unknown",
    cpu_pct: clamp01(r.cpu ?? 0),
    mem_pct: r.maxmem && r.maxmem > 0 ? clamp01((r.mem ?? 0) / r.maxmem) : 0,
    uptime_s: r.uptime ?? 0,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Number(n.toFixed(3));
}

function pveHost(c: Connection): string {
  const raw = fieldValue(c, "host") ?? "";
  if (!raw) return "https://localhost:" + DEFAULT_PORT;
  // Accept "pve.internal", "pve.internal:8006", "https://pve.internal:8006"
  if (/^https?:\/\//.test(raw)) return raw.replace(/\/$/, "");
  return `https://${raw}${raw.includes(":") ? "" : ":" + DEFAULT_PORT}`;
}

function buildAuthHeader(c: Connection): { ok: true; value: string } | { ok: false; reason: string } {
  const tokenId = fieldValue(c, "token_id");
  const tokenRef = fieldValue(c, "token");
  if (!tokenId) return { ok: false, reason: "missing token_id" };
  const tok = resolveSecret(tokenRef);
  if (!tok.ok) return { ok: false, reason: `token: ${tok.reason} (${tok.detail})` };
  // PVEAPIToken format: USER@REALM!TOKENID=SECRET
  return { ok: true, value: `PVEAPIToken=${tokenId}=${tok.value}` };
}

/** Pure helpers exported for tests. */
export const __test = { toClusterNode, toGuest, pveHost, clamp01 };
