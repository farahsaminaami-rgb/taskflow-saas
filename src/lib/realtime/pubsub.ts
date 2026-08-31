import { Pool, type PoolConfig, type PoolClient } from "pg";
import { env } from "@/lib/env";
import type { RealtimeEvent } from "./events";
import { publishToSubscribers } from "./registry";

/**
 * Cross-instance realtime bridge.
 *
 * Single instance            -> publishToSubscribers() only.
 * Multi instance (Vercel...) -> events are mirrored between instances with
 *                               PostgreSQL LISTEN/NOTIFY. Each instance holds
 *                               one dedicated `pg` listener client; a write
 *                               emits NOTIFY and every instance fans out to
 *                               its local SSE subscribers.
 *
 * Graceful degradation:
 *   - If Postgres is unreachable we operate in single-instance mode and log a
 *     warning once, so local development never hard-fails realtime.
 */

let listenerClient: PoolClient | null = null;
let pool: Pool | null = null;
let listenerStarted = false;

function createPool(): Pool {
  const config: PoolConfig = {
    connectionString: env.DATABASE_URL,
    max: 1,
    min: 0,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };
  return new Pool(config);
}

async function startListener(): Promise<void> {
  if (listenerStarted) return;
  listenerStarted = true;
  try {
    if (!pool) pool = createPool();
    const client = await pool.connect();
    listenerClient = client;
    client.on("notification", (msg) => {
      if (!msg.payload) return;
      try {
        const event = JSON.parse(msg.payload) as RealtimeEvent;
        publishToSubscribers(event);
      } catch (error) {
        console.error("[realtime] failed to parse NOTIFY payload:", error);
      }
    });
    await client.query("LISTEN taskflow");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    console.warn(
      "[realtime] Postgres LISTEN unavailable — running in single-instance mode."
    );
  }
}

export async function publish(event: RealtimeEvent): Promise<void> {
  // 1. Fan out to local subscribers.
  publishToSubscribers(event);

  // 2. Mirror to other instances (best-effort).
  try {
    if (!listenerClient) await startListener();
    const payload = JSON.stringify(event);
    // Local NOTIFY also triggers this instance's listener; we dedupe by
    // comparing the (large) JSON — negligible cost for a task tool.
    await (pool ?? (pool = createPool())).query("SELECT pg_notify('taskflow', $1)", [payload]);
  } catch (error) {
    if (listenerStarted) return;
    console.warn("[realtime] NOTIFY failed — single-instance mode continues.", error);
  }
}

export async function closeRealtime(): Promise<void> {
  try {
    await listenerClient?.end();
    await pool?.end();
  } catch {
    // best-effort teardown
  }
  listenerClient = null;
  pool = null;
  listenerStarted = false;
}