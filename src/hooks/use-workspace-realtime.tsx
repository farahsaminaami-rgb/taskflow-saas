"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import type { RealtimeEvent } from "@/lib/realtime/events";
import { applyRealtimeEvent } from "@/lib/realtime/client";

const RECONNECT_BACKOFF_BASE = 1000; // ms
const MAX_BACKOFF = 15_000;
const HEARTBEAT_TIMEOUT = 35_000; // server pings every 25s

/**
 * Opens a server-sent-events stream for a workspace and pipes it into the
 * TanStack Query caches. Handles reconnection with exponential backoff plus
 * `Last-Event-ID` replay so no board mutation is lost across hiccups.
 */
export function useWorkspaceRealtime(workspaceId: string | undefined | null) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [connectionState, setConnectionState] = React.useState<"connecting" | "open" | "reconnecting">("connecting");
  const lastEventId = React.useRef(0);

  React.useEffect(() => {
    if (!workspaceId || !session?.user?.id) return;

    let source: EventSource | null = null;
    let alive = true;
    let retries = 0;
    let heartbeat: ReturnType<typeof setTimeout> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (!alive) return;
      setConnectionState(retries === 0 ? "connecting" : "reconnecting");

      try {
        source = new EventSource(`/api/realtime/board?workspaceId=${encodeURIComponent(workspaceId)}&lastEventId=${lastEventId.current}`);
      } catch {
        scheduleReconnect();
        return;
      }

      source.onopen = () => {
        setConnectionState("open");
        retries = 0;
        // Give stale streams a max lifetime (network NATs cut idle sockets).
        heartbeat = setTimeout(() => source?.close(), HEARTBEAT_TIMEOUT);
      };

      source.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as RealtimeEvent;
          if (event.workspaceId !== workspaceId) return;
          if (event.id > lastEventId.current) lastEventId.current = event.id;
          applyRealtimeEvent(queryClient, event);
        } catch (error) {
          console.error("[realtime] bad SSE payload:", error);
        }
      };

      source.onerror = () => {
        source?.close();
        if (alive) scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      clearTimeout(heartbeat);
      const delay = Math.min(RECONNECT_BACKOFF_BASE * 2 ** retries, MAX_BACKOFF);
      retries += 1;
      setConnectionState("reconnecting");
      reconnectTimer = setTimeout(connect, delay);
    };

    connect();

    return () => {
      alive = false;
      clearTimeout(heartbeat);
      clearTimeout(reconnectTimer);
      source?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, queryClient]);

  return connectionState;
}