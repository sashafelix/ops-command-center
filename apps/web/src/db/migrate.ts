/**
 * Apply pending Drizzle migrations against DATABASE_URL.
 * Run via `pnpm -F @ops/web db:migrate`.
 */

import { config as dotenvConfig } from "dotenv";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename);
// .env.local at the apps/web root
dotenvConfig({ path: path.resolve(__dirname_, "../../.env.local") });
dotenvConfig(); // also pick up .env if present

const __dirname = __dirname_;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL not set");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  console.log("[migrate] applying pending migrations…");
  await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") });
  console.log("[migrate] done");
  await sql.end();
}

main().catch((err: unknown) => {
  console.error("[migrate] failed", err);
  process.exit(1);
});
