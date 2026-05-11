/**
 * Postgres LISTEN/NOTIFY bridge — keeps the WS realtime service free of any
 * direct coupling to the web process. Web inserts a row + NOTIFY; realtime
 * (a separate Node process) LISTENs and rebroadcasts on the matching WS topic.
 *
 * Wire format: a single text payload that is canonical JSON of
 * `{ topic, payload }` where `topic` is the public WS topic name from
 * `@ops/shared` and `payload` is the per-topic event body.
 *
 * Postgres caps NOTIFY payloads at 8000 bytes. The Live and approvals
 * payloads are well under that; oversized events should fall back to a
 * subscribe-and-refetch pattern.
 */

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { WsTopic } from "@ops/shared";

export const NOTIFY_CHANNEL = "ops_event";

export async function notify(topic: WsTopic, payload: unknown): Promise<void> {
  const message = JSON.stringify({ topic, payload });
  if (message.length > 7900) {
    // Truncate body, signal a refetch on the consumer side. Real producers
    // should keep payloads compact.
    await db.execute(sql`SELECT pg_notify(${NOTIFY_CHANNEL}, ${JSON.stringify({ topic, refetch: true })})`);
    return;
  }
  await db.execute(sql`SELECT pg_notify(${NOTIFY_CHANNEL}, ${message})`);
}
