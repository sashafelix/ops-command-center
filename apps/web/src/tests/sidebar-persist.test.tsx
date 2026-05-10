import { describe, it, expect } from "vitest";
import { lsGet, lsSet, StorageKeys } from "@/lib/storage";

describe("sidebar collapse persistence", () => {
  // setup.ts installs a fresh in-memory store before every test


  it("returns false when nothing stored", () => {
    expect(lsGet(StorageKeys.sidebarCollapsed, false)).toBe(false);
  });

  it("round-trips a true value through localStorage", () => {
    lsSet(StorageKeys.sidebarCollapsed, true);
    expect(lsGet(StorageKeys.sidebarCollapsed, false)).toBe(true);
  });

  it("returns the fallback when the value is malformed JSON", () => {
    window.localStorage.setItem(StorageKeys.sidebarCollapsed, "{not json");
    expect(lsGet(StorageKeys.sidebarCollapsed, false)).toBe(false);
  });

  it("uses the documented localStorage key", () => {
    expect(StorageKeys.sidebarCollapsed).toBe("ops.sidebar.collapsed");
  });
});
