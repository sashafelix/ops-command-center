import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveSecret } from "@/server/connectors/secrets";

describe("resolveSecret", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    process.env = { ...savedEnv };
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("treats a literal as its own value", () => {
    expect(resolveSecret("sk-abc123")).toEqual({ ok: true, value: "sk-abc123" });
  });

  it("resolves env:NAME from process.env", () => {
    process.env.TEST_SECRET_KEY = "from-env";
    expect(resolveSecret("env:TEST_SECRET_KEY")).toEqual({ ok: true, value: "from-env" });
  });

  it("fails with missing_env when the env var isn't set", () => {
    delete process.env.DOES_NOT_EXIST;
    const r = resolveSecret("env:DOES_NOT_EXIST");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_env");
  });

  it("fails with missing_env on empty / null / undefined input", () => {
    for (const v of [undefined, null, ""]) {
      const r = resolveSecret(v);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("missing_env");
    }
  });

  it("flags vault:// as not yet implemented", () => {
    const r = resolveSecret("vault://kv/data/ops/anthropic#api_key");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("vault_unavailable");
  });
});
