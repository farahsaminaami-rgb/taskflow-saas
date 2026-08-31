import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 6+ config file (ready for Prisma 7, which drops `package.json#prisma`).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});