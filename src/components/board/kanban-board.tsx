"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useRef } from "react";
import { useBoard, tasksOfColumn } from "@/hooks/use-board";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { BoardColumn } from "@/components/board/board-column";
import { TaskCardDragPreview } from "@/components/board/task-card";
import { TaskModal } from "@/components/task/task-modal";
import { useBoardStore } from "@/stores/board-store";
import type { BoardRow } from "@/lib/realtime/client";

/**
 * Kanban board with native drag-and-drop (dnd-kit).
 *
 * Strategy: dnd-kit handles pointer/keyboard sensing and proximity; the
 * component reads column/task shapes from the shared TanStack cache and
 * reorders locally on `dragEnd` via `optimisticallyMove`, then calls the
 * server for durability + SSE broadcast to other sessions.
 */
export function KanbanBoardView({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { role } = useWorkspace();
  const canEdit = role !== "VIEWER";
  const { board, loading, error, refetch, optimisticallyMove, moveTask } = useBoard(workspaceId, projectId);
  const openTask = useBoardStore((s) => s.openTask);
  const [activeTask, setActiveTask] = React.useState<BoardRow | null>(null);
  const overColumnRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (loading || !board) {
    return <BoardLoading />;
  }
  if (error) {
    return (
      <BoardError
        message={error instanceof Error ? error.message : "Failed to load board"}
        onRetry={() => void refetch()}
      />
    );
  }

  const onDragStart = (e: DragStartEvent) => {
    const task = board.tasks.find((t) => t.id === e.active.id);
    if (task) setActiveTask(task);
  };

  const onDragOver = (e: DragOverEvent) => {
    const overId = e.over?.id;
    if (!overId) return;
    const column = board.columns.find((c) => c.id === overId);
    overColumnRef.current = typeof overId === "string" && column ? overId : null;
    if (column) {
      // Animate droppable highlight handled by BoardColumn via useDroppable.
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;
    if (active.id === over.id) return;
    if (!overColumnRef.current) {
      overColumnRef.current =
        board.columns.find((c) => c.id === over.id)?.id ??
        board.tasks.find((t) => t.id === over.id)?.columnId ??
        null;
    }

    const task = board.tasks.find((t) => t.id === active.id);
    if (!task) return;

    const targetColumnId = overColumnRef.current ?? task.columnId;
    overColumnRef.current = null;

    const targetColumn = board.columns.find((c) => c.id === targetColumnId);
    if (!targetColumn) return;

    const columnTasks = tasksOfColumn(board, targetColumnId);
    const overIndex = columnTasks.findIndex((t) => t.id === over.id);
    const position = overIndex >= 0 ? overIndex : columnTasks.length;

    // Immediate local reorder (covers the drag), then persist.
    optimisticallyMove(task.id, task.columnId, targetColumnId, task.position, position);
    try {
      await moveTask({ taskId: task.id, toColumnId: targetColumnId, position });
    } catch {
      // error toast already emitted by the query layer
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragCancel={() => setActiveTask(null)}
        onDragEnd={(e) => void onDragEnd(e)}
      >
        <div className="flex h-full flex-1 items-start gap-3 overflow-x-auto px-6 pb-6">
          {board.columns.map((column, i) => (
            <BoardColumn
              key={column.id}
              column={{ ...column, position: i }}
              tasks={tasksOfColumn(board, column.id)}
              canEdit={canEdit}
              projectId={projectId}
              onTaskClick={openTask}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeTask ? <TaskCardDragPreview task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      <TaskModal workspaceId={workspaceId} projectId={projectId} />
    </>
  );
}

function BoardLoading() {
  return (
    <div className="flex flex-1 items-start gap-3 overflow-x-auto px-6 pb-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-3 rounded-xl border bg-muted/20 p-3">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          {[0, 1, 2].map((j) => (
            <div key={j} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ))}
    </div>
  );
}

function BoardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="rounded-xl border p-8 text-center">
        <p className="font-medium text-destructive">Couldn&apos;t load the board</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        <button onClick={onRetry} className="mt-4 text-sm text-primary underline-offset-4 hover:underline">
          Try again
        </button>
      </div>
    </div>
  );
}