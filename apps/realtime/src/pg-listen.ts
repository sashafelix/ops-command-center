/**
 * LISTEN on the ops_event Postgres channel and fan events out to the WS hub.
 *
 * apps/web's ingest endpoints emit `NOTIFY ops_event` with a JSON payload of
 * `{topic, payload}` (or `{topic, refetch: true}` if the payload would have
 * exceeded Postgres' 8 KB cap). We forward those to the topic hub so any
 * connected client subscribed to the topic gets the event on its socket.
 *
 * If DATABASE_URL isn't set we skip — the now-playing tick still works in
 * isolation for dev environments without a database.
 */

import postgres, { type Sql } from "postgres";
import type { WsTopic } from "@ops/shared";
import { WsTopic as WsTopicEnum } from "@ops/shared";
import type { TopicHub } from "./topics";

const CHANNEL = "ops_event";

type ListenerHandle = { stop: () => Promise<void> };

export async function startPgListener(hub: TopicHub): Promise<ListenerHandle | null> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[realtime] DATABASE_URL not set — pg LISTEN disabled");
    return null;
  }

  // Dedicated connection: postgres-js LISTEN keeps the connection held
  // open, separate from any pool.
  const sql: Sql = postgres(url, { max: 1, idle_timeout: 0, prepare: false });
  const sub = await sql.listen(CHANNEL, (raw: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[realtime] bad NOTIFY payload (non-json)");
      return;
    }
    const msg = parsed as { topic?: unknown; payload?: unknown; refetch?: boolean };
    const topic = msg.topic;
    if (typeof topic !== "string" || !WsTopicEnum.options.includes(topic as WsTopic)) {
      console.warn("[realtime] NOTIFY missing/unknown topic", topic);
      return;
    }
    // Refetch hint: broadcast a small "refetch" marker; clients can request a
    // fresh snapshot via tRPC. Body itself can be omitted for big payloads.
    if (msg.refetch) {
      hub.broadcast(topic as WsTopic, { refetch: true });
      return;
    }
    hub.broadcast(topic as WsTopic, msg.payload);
  });
  console.log(`[realtime] LISTENing on ${CHANNEL}`);

  return {
    stop: async () => {
      await sub.unlisten();
      await sql.end();
    },
  };
}
