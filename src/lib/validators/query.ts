import { z } from "zod";

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).max(200).optional(),
  all: z.boolean().default(false),
});

export const notificationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const projectQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  archived: z.coerce.boolean().default(false),
});

export const tasksQuerySchema = z.object({
  projectId: z.string().uuid("Invalid project id"),
  search: z.string().max(120).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().uuid().optional(),
  dueWithin: z.enum(["today", "week", "overdue", "none"]).optional(),
});

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
export type TasksQueryInput = z.infer<typeof tasksQuerySchema>;