import { z } from "zod";
import { TaskPriority } from "@prisma/client";
import { slugSchema } from "./workspace";

const requiredString = (min = 1, max = 160, label = "This field") =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} is too long`);

export const createTaskSchema = z.object({
  projectId: z.string().uuid("Invalid project id"),
  columnId: z.string().uuid("Invalid column id").optional(),
  title: requiredString(1, 160, "Task title"),
  description: z.string().max(50_000).optional().or(z.literal("")),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueAt: z.coerce.date().nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).max(50).default([]),
  tagIds: z.array(z.string().uuid()).max(20).default([]),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  completedAt: z.coerce.date().nullable().optional(),
});

export const moveTaskSchema = z.object({
  taskId: z.string().uuid("Invalid task id"),
  columnId: z.string().uuid("Invalid column id"),
  position: z.number().int().min(0).default(0),
});

export const reorderTasksSchema = z.object({
  // taskId -> new index within its column
  order: z.array(z.object({ id: z.string().uuid(), position: z.number().int().min(0) })),
});

export const addCommentSchema = z.object({
  taskId: z.string().uuid("Invalid task id"),
  body: requiredString(1, 10_000, "Comment"),
});

export const updateCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: requiredString(1, 10_000, "Comment"),
});

export const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});

export const createProjectSchema = z.object({
  name: requiredString(1, 80, "Project name"),
  key: slugSchema.max(8, "Key is too long"),
  description: z.string().max(1_000).optional().or(z.literal("")),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color").default("#6366f1"),
  columns: z
    .array(z.object({ name: requiredString(1, 40, "Column name"), category: z.string() }))
    .max(10)
    .optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(20).optional(),
});

export const updateProjectColumnsSchema = z.object({
  columns: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: requiredString(1, 40, "Column name"),
        category: z.string(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#94a3b8"),
        position: z.number().int().min(0),
      })
    )
    .min(1, "A board needs at least one column")
    .max(12),
});

export const startTimeTrackingSchema = z.object({
  taskId: z.string().uuid("Invalid task id"),
});

export const stopTimeTrackingSchema = z.object({
  taskId: z.string().uuid("Invalid task id").optional(),
  note: z.string().max(500).optional(),
});

export const addManualTimeEntrySchema = z.object({
  taskId: z.string().uuid("Invalid task id"),
  minutes: z.number().int().min(1).max(1440 * 7, "Value too large"),
  note: z.string().max(500).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;