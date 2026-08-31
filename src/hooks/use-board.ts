"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getBoardAction } from "@/actions/project.actions";
import { moveTaskAction, updateTaskAction } from "@/actions/task.actions";
import { boardKey, type BoardData, type BoardRow } from "@/lib/realtime/client";
import { toast } from "sonner";

/**
 * Board data hook.
 *
 * Reads/writes the TanStack Query cache directly so drag & drop is optimistic:
 * reorder locally -> fire `moveTaskAction` -> server patches other clients via
 * the SSE stream; on failure we revalidate from the server.
 */
export function useBoard(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  const key = boardKey(workspaceId, projectId);

  const boardQuery = useQuery<BoardData>({
    queryKey: key,
    queryFn: () => getBoardAction(workspaceId, projectId),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ taskId, toColumnId, position }: { taskId: string; toColumnId: string; position: number }) => {
      const result = await moveTaskAction(workspaceId, { taskId, columnId: toColumnId, position });
      if (!result.ok) throw new Error(result.error);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to move task.");
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  /** Optimistic local move used during dragEnd. */
  const optimisticallyMove = React.useCallback(
    (taskId: string, fromColumnId: string, toColumnId: string, fromIndex: number, toIndex: number) => {
      const data = queryClient.getQueryData<BoardData>(key);
      if (!data) return;
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) return;

      let tasks = data.tasks.filter((t) => t.id !== taskId);

      const clamp = (i: number, max: number) => Math.max(0, Math.min(i, max));

      if (fromColumnId === toColumnId) {
        const column = tasks.filter((t) => t.columnId === toColumnId).sort((a, b) => a.position - b.position);
        const clamped = clamp(toIndex, column.length);
        column.splice(clamped, 0, { ...task, columnId: toColumnId });
        const byId = new Map(column.map((t, i) => [t.id, i]));
        tasks = tasks.map((t) =>
          t.columnId === toColumnId && byId.has(t.id) ? { ...t, position: byId.get(t.id)! } : t
        );
      } else {
        const dest = tasks.filter((t) => t.columnId === toColumnId).sort((a, b) => a.position - b.position);
        const src = tasks.filter((t) => t.columnId === fromColumnId).sort((a, b) => a.position - b.position);
        const clamped = clamp(toIndex, dest.length);
        dest.splice(clamped, 0, { ...task, columnId: toColumnId });
        dest.forEach((t, i) => (t.position = i));
        src.forEach((t, i) => (t.position = i));
        const reindexed = new Map([...dest, ...src].map((t) => [t.id, t]));
        tasks = tasks.map((t) => reindexed.get(t.id) ?? t);
      }

      queryClient.setQueryData<BoardData>(key, { ...data, tasks });
    },
    [key, queryClient]
  );

  /** Complete a task (toggle done) from the modal. */
  const completeMutation = useMutation({
    mutationFn: async ({ taskId, done }: { taskId: string; done: boolean }) => {
      const result = await updateTaskAction(workspaceId, taskId, {
        completedAt: done ? new Date() : null,
      });
      if (!result.ok) throw new Error(result.error);
    },
    onMutate: ({ taskId, done }) => {
      const data = queryClient.getQueryData<BoardData>(key);
      if (!data) return;
      queryClient.setQueryData<BoardData>(key, {
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === taskId ? { ...t, completedAt: done ? new Date().toISOString() : null } : t
        ),
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update task.");
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return {
    board: boardQuery.data,
    loading: boardQuery.isPending,
    error: boardQuery.error,
    refetch: boardQuery.refetch,
    optimisticallyMove,
    moveTask: moveMutation.mutateAsync,
    moving: moveMutation.isPending,
    completeTask: completeMutation.mutate,
  };
}

export function tasksOfColumn(board: BoardData | undefined, columnId: string): BoardRow[] {
  if (!board) return [];
  return board.tasks
    .filter((t) => t.columnId === columnId)
    .sort((a, b) => a.position - b.position);
}