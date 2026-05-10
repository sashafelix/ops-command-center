/**
 * Typed read/write helpers for the kv_meta singleton blobs. Each surface that
 * needs a per-area aggregate (live.kpi, trust.kpi, etc.) lives behind a typed
 * key so the router code stays narrow.
 *
 * P7 ingestion will keep these keys fresh as real data flows in.
 */

import { eq } from "drizzle-orm";
import { db, schema } from "./client";

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db
    .select({ data: schema.kv_meta.data })
    .from(schema.kv_meta)
    .where(eq(schema.kv_meta.key, key));
  if (!row) return fallback;
  return row.data as T;
}

export async function kvSet<T>(key: string, data: T): Promise<void> {
  await db
    .insert(schema.kv_meta)
    .values({ key, data: data as unknown as Record<string, unknown> })
    .onConflictDoUpdate({
      target: schema.kv_meta.key,
      set: {
        data: data as unknown as Record<string, unknown>,
        updated_at: new Date(),
      },
    });
}
