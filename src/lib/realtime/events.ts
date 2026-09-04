/**
 * Realtime event contract shared between server (`realtime/dispatch.ts`) and
 * the SSE route + client hook. Keeping a single source of truth prevents drift.
 */

export const RealtimeTopic = "taskflow" as const;

export type RealtimeEventType =
  | "task.created"
  | "task.updated"
  | "task.moved"
  | "task.archived"
  | "task.deleted"
  | "column.updated"
  | "column.created"
  | "comment.added"
  | "notification.created"
  | "member.joined"
  | "member.left"
  | "project.updated"
  | "client.updated"
  | "invoice.updated"
  | "ai.created";

export interface RealtimeEvent<T = unknown> {
  /** Server-generated sequence number (for SSE Last-Event-ID replay). */
  id: number;
  type: RealtimeEventType;
  workspaceId: string;
  projectId?: string | null;
  actorId?: string | null;
  /** Optimistic-merge payload — shaped to patch TanStack Query caches. */
  data: T;
  createdAt: number;
}

export interface TaskPatchPayload {
  id: string;
  columnId?: string;
  position?: number;
  title?: string;
  priority?: string;
  dueAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string;
  [key: string]: unknown;
}

export type TaskMovePayload = {
  taskId: string;
  fromColumnId: string;
  toColumnId: string;
  position: number;
  actorId: string;
};

export type CommentAddedPayload = {
  taskId: string;
  comment: {
    id: string;
    body: string;
    authorId: string;
    authorName: string | null;
    authorImage: string | null;
    createdAt: string;
  };
};

/** Workspace-scoped channel name (must match Postgres NOTIFY conventions). */
export function workspaceChannel(workspaceId: string): string {
  return `${RealtimeTopic}_ws_${workspaceId}`;
}

export function isRealtimeEventType(value: string): value is RealtimeEventType {
  return [
    "task.created",
    "task.updated",
    "task.moved",
    "task.archived",
    "task.deleted",
    "column.updated",
    "column.created",
    "comment.added",
    "notification.created",
    "member.joined",
    "member.left",
    "project.updated",
    "client.updated",
    "invoice.updated",
    "ai.created",
  ].includes(value);
}