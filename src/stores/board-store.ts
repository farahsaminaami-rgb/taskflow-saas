"use client";

import { create } from "zustand";

/**
 * Board UI state — which task is open in the modal, whether the "create task"
 * composer is visible for a given column, and which task is being dragged.
 */
interface BoardStore {
  selectedTaskId: string | null;
  openTask: (taskId: string) => void;
  closeTask: () => void;

  creatingForColumnId: string | null;
  setCreatingForColumn: (columnId: string | null) => void;
}

export const useBoardStore = create<BoardStore>((set) => ({
  selectedTaskId: null,
  openTask: (taskId) => set({ selectedTaskId: taskId }),
  closeTask: () => set({ selectedTaskId: null }),

  creatingForColumnId: null,
  setCreatingForColumn: (creatingForColumnId) => set({ creatingForColumnId }),
}));