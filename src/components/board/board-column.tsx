"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus, SunMedium } from "lucide-react";
import { cn } from "@/lib/utils";
import { BoardTaskCard } from "@/components/board/task-card";
import { CreateTaskComposer } from "@/components/board/create-task-composer";
import { useBoardStore } from "@/stores/board-store";
import type { BoardRow } from "@/lib/realtime/client";

export interface ColumnShape {
  id: string;
  name: string;
  category: string;
  position: number;
  color: string;
}

export function BoardColumn({
  column,
  tasks,
  canEdit,
  projectId,
  onTaskClick,
}: {
  column: ColumnShape;
  tasks: BoardRow[];
  canEdit: boolean;
  projectId: string;
  onTaskClick: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const creatingHere = useBoardStore((s) => s.creatingForColumnId === column.id);
  const setCreatingForColumn = useBoardStore((s) => s.setCreatingForColumn);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex max-h-full w-72 shrink-0 flex-col rounded-xl border bg-muted/25 transition-shadow",
        isOver && "border-primary/60 bg-primary/[0.04] shadow-lg shadow-primary/10"
      )}
    >
      {/* Column header */}
      <header className="flex items-center justify-between px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
          <h3 className="text-sm font-semibold">{column.name}</h3>
          <span className="rounded-full bg-background px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
            {tasks.length}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={() => setCreatingForColumn(column.id)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={`Add task to ${column.name}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* Tasks */}
      <div className="flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {tasks.map((task, index) => (
          <BoardTaskCard key={task.id} task={task} index={index} columnId={column.id} onClick={() => onTaskClick(task.id)} />
        ))}
        {creatingHere && canEdit ? (
          <CreateTaskComposer projectId={projectId} columnId={column.id} onClose={() => setCreatingForColumn(null)} />
        ) : null}
        {tasks.length === 0 && !creatingHere && (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 text-muted-foreground/60">
            <SunMedium className="h-4 w-4" />
            <span className="text-xs">{canEdit ? "Drop a task or add one" : "No tasks"}</span>
          </div>
        )}
      </div>
    </section>
  );
}