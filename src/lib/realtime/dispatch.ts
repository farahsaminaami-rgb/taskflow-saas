import type {
  RealtimeEvent,
  RealtimeEventType,
} from "./events";
import { publish } from "./pubsub";
import { publishToSubscribers } from "./registry";

const globalSeq = globalThis as unknown as { __taskflowEventSeq?: number };

/**
 * Dispatch a realtime event after a successful write. Services call this with
 * the tenant + shape already validated; never trust data from here.
 */
export async function dispatchEvent<T>(input: {
  type: RealtimeEventType;
  workspaceId: string;
  projectId?: string | null;
  actorId?: string | null;
  data: T;
}): Promise<number> {
  const id = (globalSeq.__taskflowEventSeq = (globalSeq.__taskflowEventSeq ?? 0) + 1);
  const event: RealtimeEvent<T> = {
    id,
    type: input.type,
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    actorId: input.actorId ?? null,
    data: input.data,
    createdAt: Date.now(),
  };

  // Fire and forget — realtime continuity must not block the mutation that
  // produced the event. The DB commit is the source of truth for recovery.
  void publish(event).catch(() => {
    publishToLocalOnly(event);
  });

  return id;
}

/** Local fallback when the NOTIFY bridge fails. */
function publishToLocalOnly<T>(event: RealtimeEvent<T>): void {
  publishToSubscribers(event as RealtimeEvent);
}