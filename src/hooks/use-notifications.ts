"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { markNotificationsReadAction } from "@/actions/notifications.actions";

const listKey = (workspaceId: string) => ["notifications", workspaceId] as const;

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
  taskId: string | null;
  actor: { id: string; name: string | null; image: string | null } | null;
}

export function useNotifications(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const enabled = !!workspaceId;

  const listQuery = useQuery({
    queryKey: listKey(workspaceId ?? ""),
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/notifications?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to load notifications");
      return (await res.json()) as { notifications: NotificationItem[]; unread: number };
    },
  });

  const unreadCountQuery = useQuery({
    queryKey: ["notifications-unread", workspaceId ?? ""],
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/notifications/unread?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to count unread");
      const data = (await res.json()) as { count: number };
      return data.count;
    },
  });

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      return markNotificationsReadAction(workspaceId!, { ids, all: false });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(workspaceId ?? "") });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread", workspaceId ?? ""] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => markNotificationsReadAction(workspaceId!, { all: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(workspaceId ?? "") });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread", workspaceId ?? ""] });
    },
  });

  /** Called by the realtime subscriber when `notification.created` arrives. */
  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: listKey(workspaceId ?? "") });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread", workspaceId ?? ""] });
  }, [queryClient, workspaceId]);

  return {
    notifications: listQuery.data?.notifications ?? [],
    unread: unreadCountQuery.data ?? 0,
    isLoading: listQuery.isPending,
    error: listQuery.error,
    markRead,
    markAllRead,
    invalidate,
  };
}