"use server";

import { requireSession } from "@/lib/auth-gate";
import { commentService } from "@/services/comment.service";
import { notificationService } from "@/services/notification.service";
import { timeTrackingService } from "@/services/time-tracking.service";
import {
  addCommentSchema,
  startTimeTrackingSchema,
  addManualTimeEntrySchema,
} from "@/lib/validators/task";
import { markNotificationsReadSchema } from "@/lib/validators/query";
import { ActionResult, fail, ok } from "@/lib/validators";

export async function addCommentAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const parsed = addCommentSchema.safeParse(input);
    if (!parsed.success) return fail("Comment is required.");
    const comment = await commentService.add(workspaceId, session.user.id, parsed.data);
    return ok({ id: comment.id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to add the comment.");
  }
}

export async function startTimerAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResult<{ id: string; startedAt: string }>> {
  try {
    const session = await requireSession();
    const parsed = startTimeTrackingSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid task.");
    const timer = await timeTrackingService.startTimer(workspaceId, session.user.id, parsed.data.taskId);
    return ok({ id: timer.id, startedAt: timer.startedAt.toISOString() });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to start the timer.");
  }
}

export async function stopTimerAction(
  workspaceId: string,
  note?: string
): Promise<ActionResult<{ minutes: number }>> {
  try {
    const session = await requireSession();
    const { minutes } = await timeTrackingService.stopTimer(workspaceId, session.user.id, note);
    return ok({ minutes });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to stop the timer.");
  }
}

export async function addManualTimeAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = addManualTimeEntrySchema.safeParse(input);
    if (!parsed.success) return fail("Invalid duration.");
    await timeTrackingService.addManualEntry(workspaceId, session.user.id, parsed.data);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to log time.");
  }
}

export async function markNotificationsReadAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = markNotificationsReadSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid notification payload.");
    await notificationService.markRead(workspaceId, session.user.id, parsed.data.ids ?? [], parsed.data.all);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update notifications.");
  }
}