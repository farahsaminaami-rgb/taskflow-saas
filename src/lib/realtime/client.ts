import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeEvent, TaskMovePayload } from "./events";

/**
 * Client-side patch engine. SSE events -> targeted TanStack Query cache
 * updates with zero network churn. Any event type that can't be patched falls
 * back to `invalidateQueries` so the server remains the source of truth.
 */

/** Extra cache domains can subscribe for realtime events (notifications…). */
const realtimeListeners = new Set<(event: RealtimeEvent) => void>();

export function registerRealtimeListener(listener: (event: RealtimeEvent) => void): () => void {
  realtimeListeners.add(listener);
  return () => realtimeListeners.delete(listener);
}

export function applyRealtimeEvent(queryClient: QueryClient, event: RealtimeEvent) {
  patchBoardCaches(queryClient, event.workspaceId, event);
  for (const listener of realtimeListeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("[realtime] listener threw:", error);
    }
  }
}

export const boardKey = (workspaceId: string, projectId: string) =>
  ["board", workspaceId, projectId] as const;

export interface BoardRow {
  id: string;
  title: string;
  columnId: string;
  position: number;
  priority: string;
  dueAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date;
  assignees?: Array<{ user: { id: string; name: string | null; image: string | null } }>;
  tags?: Array<{ tag: { id: string; name: string; color: string } }>;
  _count?: { comments: number; attachments: number; timeEntries: number };
  timeEntries?: Array<{ minutes: number }>;
  [key: string]: unknown;
}

export interface BoardData {
  project: { id: string; name: string; key: string; color: string; tags: unknown[] };
  columns: Array<{ id: string; name: string; category: string; position: number; color: string }>;
  tasks: BoardRow[];
  members: unknown[];
}

export function patchBoardCaches(queryClient: QueryClient, workspaceId: string, event: RealtimeEvent) {
  const caches = queryClient.getQueryCache().findAll({
    queryKey: ["board", workspaceId],
    type: "active",
  });

  for (const { queryKey, state } of caches) {
    const existing = state?.data as BoardData | undefined;
    if (!existing) {
      void queryClient.invalidateQueries({ queryKey });
      continue;
    }
    void applyToBoard(queryClient, queryKey as string[], existing, workspaceId, event);
  }
}

async function applyToBoard(
  queryClient: QueryClient,
  key: string[],
  board: BoardData,
  workspaceId: string,
  event: RealtimeEvent
) {
  const payload = event.data as Record<string, unknown>;
  const next: BoardData = { ...board, tasks: [...board.tasks], columns: [...board.columns] };

  switch (event.type) {
    case "task.moved": {
      const p = payload as TaskMovePayload;
      const task = next.tasks.find((t) => t.id === p.taskId);
      if (task) {
        // Remove from old slot.
        next.tasks = next.tasks.filter((t) => t.id !== p.taskId);
        // Shift up everything after it in the source column.
        next.tasks = next.tasks.map((t) =>
          t.columnId === p.fromColumnId && t.position > task.position
            ? { ...t, position: t.position - 1 }
            : t
        );
        // Insert at target column/position.
        const pushed = next.tasks
          .filter((t) => t.columnId === p.toColumnId && t.position >= p.position)
          .map((t) => ({ ...t, position: t.position + 1 }));
        next.tasks = [
          ...next.tasks.filter((t) => t.columnId !== p.toColumnId || t.position < p.position),
          ...pushed,
          { ...task, columnId: p.toColumnId, position: p.position },
        ];
      }
      break;
    }
    case "task.created": {
      const task = payload.task as BoardRow;
      const column = next.tasks
        .filter((t) => t.columnId === task.columnId)
        .sort((a, b) => a.position - b.position);
      const position = column.length ? column[column.length - 1].position + 1 : 0;
      next.tasks.push({ ...task, position });
      break;
    }
    case "task.updated": {
      const patch = payload.task as Partial<BoardRow> & { id: string };
      next.tasks = next.tasks.map((t) => (t.id === patch.id ? { ...t, ...patch } : t));
      break;
    }
    case "task.archived":
    case "task.deleted": {
      const id = (payload.taskId as string) ?? (payload.task as { id: string })?.id;
      next.tasks = next.tasks.filter((t) => t.id !== id);
      break;
    }
    case "comment.added": {
      const { taskId } = payload as { taskId: string };
      next.tasks = next.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const current = t._count ?? { comments: 0, attachments: 0, timeEntries: 0 };
        return {
          ...t,
          _count: {
            comments: current.comments + 1,
            attachments: current.attachments,
            timeEntries: current.timeEntries,
          },
        };
      });
      break;
    }
    case "column.updated": {
      const cols = (payload.columns ?? []) as BoardData["columns"];
      if (cols.length) {
        next.columns = cols.map((c, i) => ({ ...c, position: i }));
      }
      break;
    }
    default:
      // Generic mutation — refetch this board (e.g. member joins/leaves).
      void queryClient.invalidateQueries({ queryKey: key });
      return;
  }

  queryClient.setQueryData<BoardData>(key, next);
}