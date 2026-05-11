import { describe, it, expect } from "vitest";
import { deriveStatus, FRESH_TEST_WINDOW_MS } from "@/server/connectors/derive-status";
import type { ConnectionField } from "@/server/mock/seed";

const anthropicFields = (apiKey: string): ConnectionField[] => [
  { k: "base_url", label: "Base URL", type: "url", value: "https://api.anthropic.com/v1" },
  { k: "api_key", label: "API key", type: "secret", value: apiKey },
];

describe("deriveStatus", () => {
  it("returns 'stub' when no connector is registered for the id", () => {
    expect(
      deriveStatus({
        id: "made-up-thing",
        fields: [{ k: "x", label: "x", type: "string", value: "value" }],
      }),
    ).toEqual({ status: "stub", health: "warn" });
  });

  it("returns 'incomplete' when required fields are empty", () => {
    expect(
      deriveStatus({
        id: "anthropic",
        fields: anthropicFields(""),
      }),
    ).toEqual({ status: "incomplete", health: "warn" });
  });

  it("treats whitespace-only required values as incomplete", () => {
    expect(
      deriveStatus({
        id: "anthropic",
        fields: anthropicFields("   "),
      }),
    ).toEqual({ status: "incomplete", health: "warn" });
  });

  it("returns 'unverified' when complete but never tested", () => {
    expect(
      deriveStatus({
        id: "anthropic",
        fields: anthropicFields("env:ANTHROPIC_API_KEY"),
      }),
    ).toEqual({ status: "unverified", health: "warn" });
  });

  it("returns 'connected' when the last test passed inside the freshness window", () => {
    expect(
      deriveStatus({
        id: "anthropic",
        fields: anthropicFields("env:ANTHROPIC_API_KEY"),
        last_test_at: new Date(Date.now() - 60_000),
        last_test_ok: true,
      }),
    ).toEqual({ status: "connected", health: "ok" });
  });

  it("downgrades a stale pass to 'unverified'", () => {
    expect(
      deriveStatus({
        id: "anthropic",
        fields: anthropicFields("env:ANTHROPIC_API_KEY"),
        last_test_at: new Date(Date.now() - FRESH_TEST_WINDOW_MS - 60_000),
        last_test_ok: true,
      }),
    ).toEqual({ status: "unverified", health: "warn" });
  });

  it("returns 'needs-attention' when the last test failed", () => {
    expect(
      deriveStatus({
        id: "anthropic",
        fields: anthropicFields("env:ANTHROPIC_API_KEY"),
        last_test_at: new Date(Date.now() - 60_000),
        last_test_ok: false,
      }),
    ).toEqual({ status: "needs-attention", health: "bad" });
  });

  it("accepts an ISO string for last_test_at", () => {
    expect(
      deriveStatus({
        id: "anthropic",
        fields: anthropicFields("env:ANTHROPIC_API_KEY"),
        last_test_at: new Date(Date.now() - 30_000).toISOString(),
        last_test_ok: true,
      }),
    ).toEqual({ status: "connected", health: "ok" });
  });
});
