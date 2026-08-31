import { PrismaClient } from "@prisma/client";

/**
 * Global singleton PrismaClient.
 *
 * Next.js hot-reloads modules during development, which would otherwise create
 * a new connection pool per HMR cycle and exhaust Postgres connections. The
 * client is cached on `globalThis` so a single instance survives reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type Db = PrismaClient;
export default prisma;