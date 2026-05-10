import { describe, it, expect } from "vitest";
import { pushRecent, readRecents } from "@/components/cmdk/recents-store";
import { StorageKeys } from "@/lib/storage";

describe("Cmd+K recents", () => {
  // setup.ts installs a fresh in-memory store before every test


  it("starts empty", () => {
    expect(readRecents()).toEqual([]);
  });

  it("persists most-recent-first and dedupes by id", () => {
    pushRecent({ id: "live", label: "Live", href: "/live" });
    pushRecent({ id: "trust", label: "Trust", href: "/trust" });
    pushRecent({ id: "live", label: "Live", href: "/live" });
    const recents = readRecents();
    expect(recents.map((r) => r.id)).toEqual(["live", "trust"]);
  });

  it("caps at 3 entries", () => {
    for (const id of ["a", "b", "c", "d", "e"]) {
      pushRecent({ id, label: id, href: `/${id}` });
    }
    expect(readRecents().map((r) => r.id)).toEqual(["e", "d", "c"]);
  });

  it("uses the documented localStorage key", () => {
    expect(StorageKeys.cmdkRecents).toBe("ops.cmdk.recents");
    pushRecent({ id: "x", label: "X", href: "/x" });
    expect(window.localStorage.getItem(StorageKeys.cmdkRecents)).not.toBeNull();
  });
});
