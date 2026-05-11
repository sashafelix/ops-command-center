/**
 * Webhook delivery worker.
 *
 * apps/web's audit-append.ts enqueues a row in `webhook_deliveries` for every
 * audit event that matches a registered webhook's `events` list (or the
 * `audit.row` wildcard). This worker pulls those rows, POSTs the payload to
 * each webhook URL with an HMAC signature, and updates the delivery state.
 *
 * Why here and not in apps/web:
 *   - Outbound HTTP with retry semantics doesn't belong in a Next.js
 *     request handler. apps/realtime already has setInterval ticks
 *     (sync-tick) so adding one more is the obvious place.
 *   - LISTEN/NOTIFY gives us low-latency wakeup without polling tightly.
 *
 * Reliability model:
 *   - Wakes immediately on NOTIFY (sub-second latency for common case)
 *   - Polls every 10s as a safety net so missed NOTIFYs don't strand rows
 *   - At-least-once delivery: a crash during fetch leaves the row pending,
 *     so retries may produce duplicate deliveries (receivers should be
 *     idempotent — we set x-ops-delivery-id for dedupe).
 *   - Retry backoff: 30s, 1m, 5m, 30m, 2h, then dead (5 attempts max)
 *   - 4xx responses are treated as "receiver said no, don't retry"; only
 *     5xx and network errors retry.
 */

import postgres, { type Sql } from "postgres";
import { createHmac } from "node:crypto";

const POLL_INTERVAL_MS = 10_000;
const CLAIM_BATCH = 20;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 5;
const BACKOFF_SECONDS = [30, 60, 300, 1800, 7200] as const; // 30s, 1m, 5m, 30m, 2h

type DeliveryRow = {
  id: string;
  webhook_id: string;
  event_id: string;
  event_action: string;
  payload: unknown;
  attempts: number;
};

type WebhookRow = {
  id: string;
  url: string;
  status: string;
};

export async function startWebhookTick(): Promise<() => Promise<void>> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[realtime] DATABASE_URL not set — webhook delivery disabled");
    return async () => undefined;
  }

  const secret = process.env.WEBHOOK_SECRET ?? "";
  if (!secret) {
    console.warn("[realtime] WEBHOOK_SECRET not set — deliveries will be unsigned");
  }

  const sql = postgres(url, { max: 2, idle_timeout: 0, prepare: false });

  let running = true;
  let tickInProgress = false;

  async function runTick() {
    if (!running || tickInProgress) return;
    tickInProgress = true;
    try {
      await processBatch(sql, secret);
    } catch (err) {
      console.error("[realtime] webhook tick failed", err);
    } finally {
      tickInProgress = false;
    }
  }

  // Wake immediately on NOTIFY from apps/web's audit append path.
  await sql.listen("webhook_delivery_pending", () => {
    void runTick();
  });

  const interval = setInterval(() => void runTick(), POLL_INTERVAL_MS);
  // Catch up on anything that piled up while we were down.
  void runTick();

  console.log(
    `[realtime] webhook delivery tick · poll ${POLL_INTERVAL_MS / 1000}s · backoff ${BACKOFF_SECONDS.join("/")}s · max ${MAX_ATTEMPTS} attempts`,
  );

  return async () => {
    running = false;
    clearInterval(interval);
    await sql.end();
  };
}

async function processBatch(sql: Sql, secret: string): Promise<void> {
  const rows = await sql<DeliveryRow[]>`
    SELECT id, webhook_id, event_id, event_action, payload, attempts
    FROM webhook_deliveries
    WHERE status = 'pending'
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY created_at ASC
    LIMIT ${CLAIM_BATCH}
  `;

  if (rows.length === 0) return;

  // Process in parallel — each delivery touches its own row, so no contention.
  await Promise.all(
    rows.map((row) =>
      deliverOne(sql, secret, row).catch((err: unknown) => {
        console.error("[webhook] deliverOne crashed", err);
      }),
    ),
  );
}

async function deliverOne(sql: Sql, secret: string, row: DeliveryRow): Promise<void> {
  const webhooks = await sql<WebhookRow[]>`
    SELECT id, url, status FROM webhooks WHERE id = ${row.webhook_id}
  `;
  const webhook = webhooks[0];

  if (!webhook) {
    await sql`
      UPDATE webhook_deliveries
      SET status='dead', error='webhook deleted', next_retry_at=NULL
      WHERE id = ${row.id}
    `;
    return;
  }

  if (webhook.status === "warn") {
    // Paused — drop the delivery rather than buffering until un-paused.
    await sql`
      UPDATE webhook_deliveries
      SET status='dead', error='webhook paused', next_retry_at=NULL
      WHERE id = ${row.id}
    `;
    return;
  }

  const bodyJson = JSON.stringify(row.payload);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "ops-command-center/1.0",
    "x-ops-event": row.event_action,
    "x-ops-delivery-id": row.id,
    "x-ops-event-id": row.event_id,
  };
  if (secret) {
    headers["x-ops-signature"] = "sha256=" + createHmac("sha256", secret).update(bodyJson).digest("hex");
  }

  const attempts = row.attempts + 1;

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: bodyJson,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.ok) {
      await sql`
        UPDATE webhook_deliveries
        SET status='delivered',
            http_status=${res.status},
            delivered_at=now(),
            attempts=${attempts},
            error=NULL,
            next_retry_at=NULL
        WHERE id = ${row.id}
      `;
      return;
    }

    // 4xx — receiver rejected. Don't retry: their answer won't change.
    if (res.status >= 400 && res.status < 500) {
      await sql`
        UPDATE webhook_deliveries
        SET status='dead',
            http_status=${res.status},
            attempts=${attempts},
            error=${`HTTP ${res.status} (client error, not retried)`},
            next_retry_at=NULL
        WHERE id = ${row.id}
      `;
      return;
    }

    // 5xx — server error, retry.
    await scheduleRetry(sql, row.id, attempts, res.status, `HTTP ${res.status}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await scheduleRetry(sql, row.id, attempts, null, msg);
  }
}

async function scheduleRetry(
  sql: Sql,
  id: string,
  attempts: number,
  httpStatus: number | null,
  error: string,
): Promise<void> {
  if (attempts >= MAX_ATTEMPTS) {
    await sql`
      UPDATE webhook_deliveries
      SET status='dead',
          http_status=${httpStatus},
          attempts=${attempts},
          error=${error},
          next_retry_at=NULL
      WHERE id = ${id}
    `;
    return;
  }
  const seconds =
    BACKOFF_SECONDS[attempts - 1] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]!;
  await sql`
    UPDATE webhook_deliveries
    SET status='pending',
        http_status=${httpStatus},
        attempts=${attempts},
        error=${error},
        next_retry_at=now() + (${seconds} * interval '1 second')
    WHERE id = ${id}
  `;
}

/** Pure helpers exported for tests. */
export const __test = { BACKOFF_SECONDS, MAX_ATTEMPTS };
