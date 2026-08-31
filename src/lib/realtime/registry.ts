import type { RealtimeEvent } from "./events";

/**
 * In-process subscriber registry.
 *
 * Each Node instance keeps a Map of channel -> set of SSE connections. When a
 * publish occurs we fan out to every live connection on this instance. In a
 * multi-instance deployment the Postgres bridge (`pubsub.ts`) mirrors events
 * across instances via LISTEN/NOTIFY.
 */

export interface ChannelSubscriber {
  /** Controller for closing the SSE response. */
  signal: AbortSignal;
  /** Serialize + write one event to the socket. */
  send(event: RealtimeEvent): void;
}

const channels = new Map<string, Set<ChannelSubscriber>>();

/** Recent events per channel — allows `Last-Event-ID` replay for reconnect. */
const ringBuffers = new Map<string, RealtimeEvent[]>();
const RING_LIMIT = 200;

export function subscribe(channel: string, subscriber: ChannelSubscriber): () => void {
  let set = channels.get(channel);
  if (!set) {
    set = new Set();
    channels.set(channel, set);
  }
  set.add(subscriber);
  return () => {
    set!.delete(subscriber);
    if (set!.size === 0) channels.delete(channel);
  };
}

export function publishToSubscribers(event: RealtimeEvent): void {
  const channel = `taskflow_ws_${event.workspaceId}`;
  const set = channels.get(channel);
  if (set) {
    for (const sub of set) {
      if (sub.signal.aborted) continue;
      try {
        sub.send(event);
      } catch {
        // A dead socket must never break the fan-out loop.
      }
    }
  }
  appendRingBuffer(channel, event);
}

export function replay(channel: string, lastEventId: number): RealtimeEvent[] {
  const buf = ringBuffers.get(channel) ?? [];
  return buf.filter((event) => event.id > lastEventId);
}

function appendRingBuffer(channel: string, event: RealtimeEvent): void {
  let buf = ringBuffers.get(channel);
  if (!buf) {
    buf = [];
    ringBuffers.set(channel, buf);
  }
  buf.push(event);
  if (buf.length > RING_LIMIT) buf.splice(0, buf.length - RING_LIMIT);
}

/** Test helper: state held by this process — not used in normal flow. */
export const _registry = { channels, ringBuffers };