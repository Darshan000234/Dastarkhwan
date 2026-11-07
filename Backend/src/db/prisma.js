import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to Backend/.env.");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // Tune this for your hosting provider's connection limits.
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
});

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__dastarkhwanPrisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__dastarkhwanPrisma = prisma;
}

export default prisma;
