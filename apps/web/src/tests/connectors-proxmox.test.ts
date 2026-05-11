import { describe, it, expect } from "vitest";
import { __test } from "@/server/connectors/proxmox";

const { toClusterNode, toGuest, pveHost, clamp01 } = __test;

describe("proxmox response shaping", () => {
  it("clamp01 keeps numbers in [0,1] and rounds to 3 decimals", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.1234)).toBe(0.123);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it("toClusterNode normalizes online/offline and derives mem_pct from maxmem", () => {
    const n = toClusterNode({
      node: "pve1",
      status: "online",
      cpu: 0.42,
      mem: 8 * 1024 * 1024 * 1024,
      maxmem: 16 * 1024 * 1024 * 1024,
      maxcpu: 8,
      uptime: 86400,
    });
    expect(n.id).toBe("pve-pve1");
    expect(n.status).toBe("online");
    expect(n.cpu_pct).toBe(0.42);
    expect(n.mem_pct).toBe(0.5);
    expect(n.maxcpu).toBe(8);
  });

  it("toClusterNode maps unknown status to 'unknown'", () => {
    expect(toClusterNode({ node: "pve2", status: "something-weird" }).status).toBe("unknown");
  });

  it("toGuest maps qemu + lxc kinds and falls back to vmid for name", () => {
    const vm = toGuest({ vmid: 100, status: "running", cpu: 0.1, mem: 1, maxmem: 2 }, "qemu", "pve1");
    expect(vm.id).toBe("qemu-100");
    expect(vm.kind).toBe("qemu");
    expect(vm.name).toBe("qemu-100");
    expect(vm.status).toBe("running");
    expect(vm.mem_pct).toBe(0.5);

    const ct = toGuest({ vmid: 200, name: "redis", status: "stopped" }, "lxc", "pve2");
    expect(ct.id).toBe("lxc-200");
    expect(ct.name).toBe("redis");
    expect(ct.status).toBe("stopped");
  });

  it("pveHost coerces bare hosts to https + default port", () => {
    expect(pveHost({ fields: [{ k: "host", label: "h", type: "url", value: "pve.internal" }] } as never))
      .toBe("https://pve.internal:8006");
    expect(pveHost({ fields: [{ k: "host", label: "h", type: "url", value: "pve.internal:9999" }] } as never))
      .toBe("https://pve.internal:9999");
    expect(pveHost({ fields: [{ k: "host", label: "h", type: "url", value: "https://pve.internal:8006" }] } as never))
      .toBe("https://pve.internal:8006");
    expect(pveHost({ fields: [{ k: "host", label: "h", type: "url", value: "https://pve.internal:8006/" }] } as never))
      .toBe("https://pve.internal:8006");
  });
});
