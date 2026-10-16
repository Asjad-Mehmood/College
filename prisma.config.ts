import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load local env files (`vercel env pull` writes .env.local). On Vercel the
// variables are already in process.env, so missing files are fine.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DB_URL"],
  },
});
