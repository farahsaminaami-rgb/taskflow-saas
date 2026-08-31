"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-gate";
import { taskService } from "@/services/task.service";
import { projectService } from "@/services/project.service";
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  updateProjectColumnsSchema,
} from "@/lib/validators/task";
import { ActionResult, fail, ok } from "@/lib/validators";

export async function createTaskAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid task data.");
    const task = await taskService.create(workspaceId, session.user.id, parsed.data);
    return ok({ id: task.id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create the task.");
  }
}

export async function getTaskAction(workspaceId: string, taskId: string) {
  try {
    const session = await requireSession();
    const task = await taskService.getById(workspaceId, session.user.id, taskId);
    return { ok: true as const, data: task };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Unable to load the task." };
  }
}

export async function updateTaskAction(
  workspaceId: string,
  taskId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const parsed = updateTaskSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid task data.");
    const task = await taskService.update(workspaceId, session.user.id, taskId, parsed.data);
    return ok({ id: task.id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update the task.");
  }
}

export async function moveTaskAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const parsed = moveTaskSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid move data.");
    const task = await taskService.move(workspaceId, session.user.id, parsed.data);
    return ok({ id: task.id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to move the task.");
  }
}

export async function archiveTaskAction(
  workspaceId: string,
  taskId: string,
  archived = true
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await taskService.archive(workspaceId, session.user.id, taskId, archived);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to archive the task.");
  }
}

export async function deleteTaskAction(workspaceId: string, taskId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await taskService.remove(workspaceId, session.user.id, taskId);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to delete the task.");
  }
}

export async function updateProjectColumnsAction(
  workspaceId: string,
  projectId: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = updateProjectColumnsSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid columns.");
    await projectService.updateColumns(
      workspaceId,
      session.user.id,
      projectId,
      parsed.data.columns
    );
    revalidatePath(`/app/workspace/${workspaceId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update the board columns.");
  }
}