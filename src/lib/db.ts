import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * Normalize a PostgreSQL connection string so that reserved characters in the
 * credentials (password/username) are percent-encoded exactly once.
 *
 * Postgres URLs can carry tricky credentials — a password may contain `@`, `:`,
 * `/`, `#`, `$`, `%`, `+`, space, etc. If the raw value is pasted into
 * `DATABASE_URL` unescaped (or double-escaped) some parsers reject it with
 * "invalid domain character in database URL". This helper decodes whatever is
 * currently present and re-encodes only the reserved characters, yielding a
 * canonical, parser-safe string regardless of the source formatting.
 *
 * - `password=abc%40def`  -> `abc%40def` (already correct, left canonical)
 * - `password=abc@def`    -> `abc%40def` (raw `@` is escaped)
 * - `password=%258`       -> `%258`     (a literal `%8`, not double-mangled)
 */
export function normalizeDatabaseUrl(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.username = encodeURIComponent(decodeURIComponent(url.username || ""));
    url.password = encodeURIComponent(decodeURIComponent(url.password || ""));
    // `URL` normalizes the path; keep the leading "/" for the default database.
    return url.toString();
  } catch {
    // Never crash the app on a malformed string — let the underlying driver
    // report the real error further down the stack.
    return raw;
  }
}

/**
 * Create the PrismaClient singleton wired to the `pg` (node-postgres) driver
 * adapter.
 *
 * Using the PostgreSQL driver adapter instead of Prisma's built-in engine keeps
 * the connection compatible with connection-pooled endpoints such as the
 * Supabase Transaction Pooler (which Prisma's Rust engine cannot reach). The
 * adapter is handed a `pg.Pool` so node-postgres — the component already proven
 * to connect — owns the underlying TCP connection and parses the URL itself,
 * bypassing Prisma's stricter connection-string parser.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

  // Reuse the pool across HMR reloads to avoid exhausting Postgres sockets.
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new pg.Pool({ connectionString });
  }

  const adapter = new PrismaPg(globalForPrisma.pgPool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type Db = PrismaClient;
export default prisma;
