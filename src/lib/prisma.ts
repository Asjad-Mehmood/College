import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DB_URL;
  if (!connectionString) {
    throw new Error("DB_URL is not set");
  }
  // Neon is reached over WebSockets; a local Postgres (for offline
  // development) needs a plain TCP connection instead.
  const { hostname } = new URL(connectionString);
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const adapter = isLocal
    ? new PrismaPg({ connectionString })
    : new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads in development.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
