// Runs before `prisma migrate deploy` on Vercel.
//
// If a migration was started but never finished (for example the connection
// to Neon dropped mid-way), Prisma records it as failed and refuses every
// later deploy with P3009. A failed migration may have been applied only
// partway, so migrations that can fail this way are written to be re-runnable
// (IF EXISTS / IF NOT EXISTS). This script marks the failed one rolled back so
// `migrate deploy` runs it again; the recorded error is printed first so the
// real cause is visible in the build log.
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DB_URL_DIRECT ?? process.env.DB_URL?.replace("-pooler.", ".");
if (!url) {
  console.log("[migrations] DB_URL is not set; skipping the failed-migration check.");
  process.exit(0);
}

const client = new pg.Client({ connectionString: url });
let failed = [];
try {
  await client.connect();
  const res = await client.query(
    `SELECT migration_name, started_at, logs FROM _prisma_migrations
     WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at`,
  );
  failed = res.rows;
} catch (e) {
  // No migrations table yet (new database) or the database is unreachable:
  // let `migrate deploy` report whatever the real situation is.
  console.log(`[migrations] Check skipped: ${e.message}`);
} finally {
  await client.end().catch(() => {});
}

for (const m of failed) {
  console.log(`[migrations] ${m.migration_name} is recorded as failed (started ${m.started_at.toISOString()}).`);
  if (m.logs) console.log(`[migrations] Recorded error:\n${String(m.logs).slice(0, 2000)}`);
  console.log(`[migrations] Marking it rolled back so it can run again.`);
  execFileSync("npx", ["prisma", "migrate", "resolve", "--rolled-back", m.migration_name], { stdio: "inherit" });
}
