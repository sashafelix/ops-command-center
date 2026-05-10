import type { WsTopic } from "@ops/shared";

/** Per-topic subscriber state — opaque cursor enables Phase 5 resume semantics. */
export type Subscriber = {
  send: (data: string) => void;
  cursorByTopic: Map<WsTopic, string>;
};

/** Tracks subscribers per topic; supports broadcast on tick. */
export class TopicHub {
  private readonly perTopic = new Map<WsTopic, Set<Subscriber>>();

  subscribe(topic: WsTopic, sub: Subscriber): void {
    let set = this.perTopic.get(topic);
    if (!set) {
      set = new Set();
      this.perTopic.set(topic, set);
    }
    set.add(sub);
  }

  unsubscribe(topic: WsTopic, sub: Subscriber): void {
    this.perTopic.get(topic)?.delete(sub);
  }

  removeEverywhere(sub: Subscriber): void {
    for (const set of this.perTopic.values()) set.delete(sub);
  }

  broadcast(topic: WsTopic, payload: unknown): void {
    const set = this.perTopic.get(topic);
    if (!set || set.size === 0) return;
    const cursor = new Date().toISOString();
    const msg = JSON.stringify({ type: "event", topic, cursor, ts: cursor, payload });
    for (const sub of set) {
      sub.cursorByTopic.set(topic, cursor);
      try {
        sub.send(msg);
      } catch {
        /* dropped — connection cleanup handles removal */
      }
    }
  }
}
