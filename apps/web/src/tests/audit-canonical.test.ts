import { describe, it, expect } from "vitest";
import { canonicalJson } from "@ops/shared";

describe("canonicalJson", () => {
  it("sorts object keys lexicographically", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("omits undefined values (parity with JSON.stringify default)", () => {
    expect(canonicalJson({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}');
  });

  it("recurses through nested objects + arrays", () => {
    expect(canonicalJson({ z: [{ b: 2, a: 1 }, "x"], a: { b: 1 } })).toBe(
      '{"a":{"b":1},"z":[{"a":1,"b":2},"x"]}',
    );
  });

  it("escapes strings the same way JSON.stringify does", () => {
    expect(canonicalJson("a\"b\nc")).toBe('"a\\"b\\nc"');
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson(Number.NaN)).toThrow();
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("produces stable bytes for equivalent objects with different key order", () => {
    const a = { ts: "2026-05-10T09:38:06Z", actor: "mara", id: "evt_1" };
    const b = { actor: "mara", id: "evt_1", ts: "2026-05-10T09:38:06Z" };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});
