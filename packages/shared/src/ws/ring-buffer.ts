/**
 * Bounded ring buffer of recent events per topic, used for cursor-based resume.
 *
 * On WS reconnect the client sends `subscribe { topic, cursor }` carrying the
 * last cursor it observed. The hub looks up the buffer for that topic and
 * replays everything after that cursor, in order, before resuming live
 * broadcast. If the cursor is older than the buffer's oldest entry, the hub
 * signals `gap` so the client can refetch a fresh snapshot via tRPC.
 *
 * Pure data structure with no I/O — easy to unit test.
 */

export type Buffered<T> = {
  cursor: string;
  payload: T;
};

export type ReplayResult<T> = {
  status: "ok" | "gap" | "fresh";
  events: Buffered<T>[];
};

export class RingBuffer<T> {
  private buf: Buffered<T>[] = [];
  constructor(public readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error(`RingBuffer capacity must be a positive integer, got ${capacity}`);
    }
  }

  push(entry: Buffered<T>): void {
    this.buf.push(entry);
    if (this.buf.length > this.capacity) this.buf.splice(0, this.buf.length - this.capacity);
  }

  /** Last cursor in the buffer, or empty string if empty. */
  tail(): string {
    return this.buf[this.buf.length - 1]?.cursor ?? "";
  }

  /**
   * Replay strategy:
   *   - cursor === ""               → status="fresh" (first connect; no replay)
   *   - cursor === tail             → status="ok" with events=[] (caught up)
   *   - cursor found in buffer      → status="ok" with events after that cursor
   *   - cursor older than oldest    → status="gap" (client must refetch)
   */
  replayAfter(cursor: string): ReplayResult<T> {
    if (cursor === "") return { status: "fresh", events: [] };
    if (this.buf.length === 0) return { status: "gap", events: [] };
    const idx = this.buf.findIndex((e) => e.cursor === cursor);
    if (idx === -1) {
      // Either older than the oldest, or never existed; treat as gap.
      const oldest = this.buf[0]!.cursor;
      if (cursor < oldest) return { status: "gap", events: [] };
      // Cursor newer than tail — no replay needed but not exactly "fresh"; treat as ok+empty.
      return { status: "ok", events: [] };
    }
    return { status: "ok", events: this.buf.slice(idx + 1) };
  }

  size(): number {
    return this.buf.length;
  }
}
