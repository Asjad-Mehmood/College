import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load local env files (`vercel env pull` writes .env.local). On Vercel the
// variables are already in process.env, so missing files are fine.
config({ path: [".env.local", ".env"], quiet: true });

/**
 * Migrations need a direct connection: Neon's pooled host ("-pooler") can't
 * hold the advisory lock Prisma Migrate takes, which times out with P1002.
 * Use DB_URL_DIRECT if it's set, else derive the direct host from DB_URL.
 */
function migrationUrl() {
  const direct = process.env["DB_URL_DIRECT"];
  if (direct) return direct;
  return process.env["DB_URL"]?.replace("-pooler.", ".");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl(),
  },
});
