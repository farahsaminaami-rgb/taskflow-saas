"use client";

import * as React from "react";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { registerRealtimeListener } from "@/lib/realtime/client";
import { useNotifications } from "@/hooks/use-notifications";

/**
 * Mounted once per workspace route — opens the SSE stream and wires realtime
 * events into every cache domain (boards via the patch engine, notification
 * inboxes via the listener registry below).
 */
export function WorkspaceRealtimeManager() {
  const { workspaceId } = useWorkspace();
  useWorkspaceRealtime(workspaceId);
  const notifications = useNotifications(workspaceId);

  React.useEffect(() => {
    const unsubscribe = registerRealtimeListener((event) => {
      if (event.type === "notification.created") notifications.invalidate();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  return null;
}