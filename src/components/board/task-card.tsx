"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, MessageSquare, Paperclip, Clock } from "lucide-react";
import { cn, formatDate, isOverdue, formatDuration } from "@/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { BoardRow } from "@/lib/realtime/client";

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  URGENT: { label: "Urgent", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
  HIGH: { label: "High", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  MEDIUM: { label: "Medium", className: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  LOW: { label: "Low", className: "bg-muted text-muted-foreground" },
};

export function BoardTaskCard({
  task,
  index,
  columnId,
  onClick,
}: {
  task: BoardRow;
  index: number;
  columnId: string;
  onClick: () => void;
}) {
  return <SortableTaskCard task={task} index={index} columnId={columnId} onClick={onClick} />;
}

function SortableTaskCard({
  task,
  index,
  columnId,
  onClick,
}: {
  task: BoardRow;
  index: number;
  columnId: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", taskId: task.id, columnId, index },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = PRIORITY_META[String(task.priority ?? "MEDIUM")] ?? PRIORITY_META.MEDIUM;
  const totalMinutes = (task.timeEntries ?? []).reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  const commentCount = task._count?.comments ?? 0;
  const attachmentCount = task._count?.attachments ?? 0;
  const overdue = task.dueAt ? isOverdue(task.dueAt, task.completedAt ? new Date(task.completedAt) : null) : false;
  const isDone = !!task.completedAt;
  const assignees = (task.assignees ?? []).map((a) => a.user);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group cursor-pointer select-none rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "z-50 opacity-40",
        isDone && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm font-medium leading-snug", isDone && "line-through text-muted-foreground")}>
          {String(task.title ?? "")}
        </p>
        <Badge className={cn("shrink-0 text-[10px]", priority.className)}>{priority.label}</Badge>
      </div>

      {(task.tags ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(task.tags ?? []).slice(0, 3).map(({ tag }) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {task.dueAt && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                overdue ? "font-medium text-destructive" : "text-muted-foreground"
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {formatDate(task.dueAt as string, "MMM d")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs" title={`${commentCount} comments`}>
              <MessageSquare className="h-3 w-3" /> {commentCount}
            </span>
          )}
          {attachmentCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs" title={`${attachmentCount} attachments`}>
              <Paperclip className="h-3 w-3" /> {attachmentCount}
            </span>
          )}
          {totalMinutes > 0 && (
            <span className="flex items-center gap-0.5 text-xs" title={`${totalMinutes} minutes logged`}>
              <Clock className="h-3 w-3" /> {formatDuration(totalMinutes)}
            </span>
          )}
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map((user) => (
              <Avatar key={user.id} className="h-5 w-5 border-2 border-card">
                {user.image ? <AvatarImage src={user.image} /> : null}
                <AvatarFallback className="text-[8px]">
                  {(user.name ?? "?")[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
            ))}
            {assignees.length > 3 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-muted text-[8px] font-medium text-muted-foreground">
                +{assignees.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaskCardDragPreview({ task }: { task: BoardRow }) {
  const priority = PRIORITY_META[String(task.priority ?? "MEDIUM")] ?? PRIORITY_META.MEDIUM;
  return (
    <div className="w-72 rounded-lg border bg-card p-3 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{String(task.title ?? "")}</p>
        <Badge className={cn("shrink-0 text-[10px]", priority.className)}>{priority.label}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">Dragging…</span>
      </div>
    </div>
  );
}