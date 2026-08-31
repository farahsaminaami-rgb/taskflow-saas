"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBoardStore } from "@/stores/board-store";
import { TaskDetail } from "@/components/task/task-detail";

/**
 * Full task editor — opened from the board by clicking a card.
 * Rendered outside the DndContext so dragging never fights the modal.
 */
export function TaskModal({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const selectedTaskId = useBoardStore((s) => s.selectedTaskId);
  const closeTask = useBoardStore((s) => s.closeTask);

  return (
    <Dialog open={!!selectedTaskId} onOpenChange={(open) => { if (!open) closeTask(); }}>
      <DialogContent className="max-w-3xl gap-0 p-0 sm:rounded-xl">
        <DialogTitle className="sr-only">Task details</DialogTitle>
        {selectedTaskId ? (
          <TaskDetail
            key={selectedTaskId}
            workspaceId={workspaceId}
            projectId={projectId}
            taskId={selectedTaskId}
            onClose={closeTask}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}