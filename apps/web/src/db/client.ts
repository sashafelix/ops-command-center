import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Singleton DB client. Survives Next dev hot-reload via globalThis so we don't
 * leak connection pools every save. In production each Node process gets its
 * own pool — no global leak.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://ops:ops@localhost:5432/ops";

declare global {
  // eslint-disable-next-line no-var
  var __ops_pg_pool: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __ops_db: PostgresJsDatabase<typeof schema> | undefined;
}

const pool =
  globalThis.__ops_pg_pool ??
  postgres(DATABASE_URL, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 30,
    prepare: false,
  });

if (!globalThis.__ops_pg_pool) globalThis.__ops_pg_pool = pool;

export const db: PostgresJsDatabase<typeof schema> =
  globalThis.__ops_db ?? drizzle(pool, { schema });

if (!globalThis.__ops_db) globalThis.__ops_db = db;

export { schema };
export const sqlPool = pool;
