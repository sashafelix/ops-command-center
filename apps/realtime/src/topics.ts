import type { WsTopic } from "@ops/shared";
import { RingBuffer, type Buffered } from "@ops/shared";

/** Per-topic subscriber state — opaque cursor tracks the last delivered event. */
export type Subscriber = {
  send: (data: string) => void;
  cursorByTopic: Map<WsTopic, string>;
};

/** Per-topic recent-event buffer capacity. Phase 5: 256 entries. */
const BUFFER_SIZE = 256;

/**
 * Tracks subscribers per topic, broadcasts new events, and on subscribe-with-
 * cursor replays anything the subscriber missed since its last cursor (Phase 5
 * cursor resume per HANDOFF §4 realtime strategy).
 */
export class TopicHub {
  private readonly perTopic = new Map<WsTopic, Set<Subscriber>>();
  private readonly buffers = new Map<WsTopic, RingBuffer<unknown>>();
  private monotonic = 0;

  /** Issue a new cursor that strictly orders broadcasts. */
  private nextCursor(): string {
    // Padded so string compare also works (fits ≤ ~3 trillion before overflow).
    this.monotonic += 1;
    return `${Date.now().toString(36)}-${this.monotonic.toString(36).padStart(8, "0")}`;
  }

  private bufferFor(topic: WsTopic): RingBuffer<unknown> {
    let b = this.buffers.get(topic);
    if (!b) {
      b = new RingBuffer<unknown>(BUFFER_SIZE);
      this.buffers.set(topic, b);
    }
    return b;
  }

  /**
   * Subscribe + optional resume. Returns the cursor the client should now
   * consider its latest, plus the replay status. Replayed events are sent over
   * the wire before this method returns so they hit the client in chain order.
   */
  subscribe(topic: WsTopic, sub: Subscriber, cursor?: string): { status: "ok" | "gap" | "fresh"; cursor: string } {
    let set = this.perTopic.get(topic);
    if (!set) {
      set = new Set();
      this.perTopic.set(topic, set);
    }
    set.add(sub);

    const buf = this.bufferFor(topic);
    const replay = buf.replayAfter(cursor ?? "");
    for (const e of replay.events) {
      this.deliver(sub, topic, e);
    }
    const newCursor = replay.events.length > 0
      ? replay.events[replay.events.length - 1]!.cursor
      : (cursor ?? buf.tail());
    sub.cursorByTopic.set(topic, newCursor);
    return { status: replay.status, cursor: newCursor };
  }

  unsubscribe(topic: WsTopic, sub: Subscriber): void {
    this.perTopic.get(topic)?.delete(sub);
  }

  removeEverywhere(sub: Subscriber): void {
    for (const set of this.perTopic.values()) set.delete(sub);
  }

  broadcast(topic: WsTopic, payload: unknown): void {
    const cursor = this.nextCursor();
    this.bufferFor(topic).push({ cursor, payload });
    const set = this.perTopic.get(topic);
    if (!set || set.size === 0) return;
    for (const sub of set) {
      this.deliver(sub, topic, { cursor, payload });
    }
  }

  private deliver(sub: Subscriber, topic: WsTopic, e: Buffered<unknown>): void {
    sub.cursorByTopic.set(topic, e.cursor);
    const msg = JSON.stringify({ type: "event", topic, cursor: e.cursor, ts: new Date().toISOString(), payload: e.payload });
    try {
      sub.send(msg);
    } catch {
      /* dropped — connection cleanup handles removal */
    }
  }
}
