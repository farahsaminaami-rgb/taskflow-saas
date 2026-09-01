/**
 * Server-side error handling helpers.
 *
 * The goal is to make sure raw internal errors — Prisma connection failures,
 * DNS lookups, serialization issues, stack traces — are never serialized back
 * to the browser. They are logged on the server and the client receives a
 * short, safe, user-facing message instead.
 */

/** Errors the user can actually act on (e.g. duplicate account). */
const USER_FACING_MESSAGES: ReadonlyArray<string> = [
  "An account with this email already exists. Try signing in instead.",
  "Invalid email or password.",
  "Enter a valid email and password.",
  "Please fix the highlighted fields.",
];

/** A safe, human-readable default when the real cause is internal. */
const GENERIC_ERROR =
  "Something went wrong on our side. Please try again in a moment.";

/**
 * Classify an unknown thrown value and return a safe message for the UI,
 * logging the full error server-side for debugging.
 */
export function toUserFacingMessage(error: unknown, fallback = GENERIC_ERROR): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  // Connection / configuration failures are internal — never leak details.
  if (isInternalError(message)) {
    console.error("[auth] internal error (not shown to user):", error);
    return fallback;
  }

  // Known, actionable messages (duplicate email, bad credentials) pass through.
  if (USER_FACING_MESSAGES.some((known) => message.includes(known))) {
    return message;
  }

  // Unknown validator-ish messages: hide internals, keep it generic.
  console.warn("[auth] unexpected error surfaced safely:", error);
  return fallback;
}

/** Detect Prisma / driver / connection-style internals that must be hidden. */
function isInternalError(message: string): boolean {
  return (
    message.includes("connection string") ||
    message.includes("invalid domain character") ||
    message.includes("Can't reach database") ||
    message.includes("P1001") ||
    message.includes("Connection") ||
    message.includes("connect ECONNREFUSED") ||
    message.includes("connect ETIMEDOUT") ||
    message.includes("Connection refused") ||
    message.includes("database URL") ||
    message.includes("DATABASE_URL") ||
    message.includes("select") ||
    message.includes("invocation") ||
    message.includes("failed to connect") ||
    message.includes("deserialize") ||
    message.includes("Raw query failed") ||
    message.includes("query engine") ||
    message.includes("timeout")
  );
}
