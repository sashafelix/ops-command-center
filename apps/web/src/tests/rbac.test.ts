import { describe, it, expect } from "vitest";
import { hasRole } from "@/server/rbac";

describe("RBAC role hierarchy", () => {
  it("admin satisfies every required role", () => {
    expect(hasRole("admin", "viewer")).toBe(true);
    expect(hasRole("admin", "analyst")).toBe(true);
    expect(hasRole("admin", "sre")).toBe(true);
    expect(hasRole("admin", "admin")).toBe(true);
  });

  it("viewer cannot satisfy any privileged role", () => {
    expect(hasRole("viewer", "viewer")).toBe(true);
    expect(hasRole("viewer", "analyst")).toBe(false);
    expect(hasRole("viewer", "sre")).toBe(false);
    expect(hasRole("viewer", "admin")).toBe(false);
  });

  it("analyst can run evals (analyst tier) but not approvals (sre tier)", () => {
    expect(hasRole("analyst", "analyst")).toBe(true);
    expect(hasRole("analyst", "sre")).toBe(false);
  });

  it("sre can decide approvals + rollback but not workspace admin actions", () => {
    expect(hasRole("sre", "sre")).toBe(true);
    expect(hasRole("sre", "admin")).toBe(false);
  });

  it("agent (service principal) is denied UI-tier roles", () => {
    expect(hasRole("agent", "viewer")).toBe(false);
    expect(hasRole("agent", "admin")).toBe(false);
  });

  it("undefined role is always denied", () => {
    expect(hasRole(undefined, "viewer")).toBe(false);
  });
});
