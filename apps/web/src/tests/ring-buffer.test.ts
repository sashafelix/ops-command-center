import { describe, it, expect } from "vitest";
import { RingBuffer } from "@ops/shared";

describe("WS RingBuffer (cursor resume backbone)", () => {
  it("rejects non-positive capacity", () => {
    expect(() => new RingBuffer(0)).toThrow();
    expect(() => new RingBuffer(-1)).toThrow();
  });

  it("returns empty tail when never pushed", () => {
    const r = new RingBuffer<string>(8);
    expect(r.tail()).toBe("");
    expect(r.size()).toBe(0);
  });

  it("evicts oldest entries past capacity", () => {
    const r = new RingBuffer<string>(3);
    for (const c of ["a", "b", "c", "d", "e"]) {
      r.push({ cursor: c, payload: c });
    }
    expect(r.size()).toBe(3);
    expect(r.tail()).toBe("e");
    expect(r.replayAfter("c").events.map((e) => e.cursor)).toEqual(["d", "e"]);
  });

  it("treats empty cursor as 'fresh' (first-connect, no replay)", () => {
    const r = new RingBuffer<string>(8);
    r.push({ cursor: "a", payload: "a" });
    const result = r.replayAfter("");
    expect(result.status).toBe("fresh");
    expect(result.events).toEqual([]);
  });

  it("returns ok+empty when cursor matches the tail (caught up)", () => {
    const r = new RingBuffer<string>(8);
    r.push({ cursor: "a", payload: "a" });
    r.push({ cursor: "b", payload: "b" });
    const result = r.replayAfter("b");
    expect(result.status).toBe("ok");
    expect(result.events).toEqual([]);
  });

  it("replays events after a known cursor in order", () => {
    const r = new RingBuffer<number>(8);
    for (const c of ["a", "b", "c", "d", "e"]) {
      r.push({ cursor: c, payload: c.charCodeAt(0) });
    }
    const result = r.replayAfter("b");
    expect(result.status).toBe("ok");
    expect(result.events.map((e) => e.cursor)).toEqual(["c", "d", "e"]);
  });

  it("flags 'gap' when the cursor is older than the buffer's oldest entry", () => {
    const r = new RingBuffer<string>(2);
    r.push({ cursor: "b", payload: "b" });
    r.push({ cursor: "c", payload: "c" });
    // 'a' was evicted — caller must refetch via tRPC
    const result = r.replayAfter("a");
    expect(result.status).toBe("gap");
  });
});
