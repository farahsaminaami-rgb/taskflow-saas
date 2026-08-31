"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-gate";
import { projectService } from "@/services/project.service";
import { analyticsService } from "@/services/analytics.service";
import { createProjectSchema } from "@/lib/validators/task";
import { ActionResult, fail, ok } from "@/lib/validators";
import type { Prisma } from "@prisma/client";

export async function createProjectAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join(".")] = [...(fieldErrors[issue.path.join(".")] ?? []), issue.message];
      }
      return fail("Please fix the highlighted fields.", fieldErrors);
    }
    const project = await projectService.create(workspaceId, session.user.id, parsed.data);
    revalidatePath(`/app/workspace/${workspaceId}`);
    return ok({ id: project.id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create the project.");
  }
}

export async function listProjectsAction(workspaceId: string) {
  const session = await requireSession();
  return projectService.list(workspaceId, session.user.id);
}

export async function getBoardAction(workspaceId: string, projectId: string) {
  const session = await requireSession();
  return projectService.getBoard(workspaceId, session.user.id, projectId);
}

export async function archiveProjectAction(
  workspaceId: string,
  projectId: string,
  archived: boolean
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await projectService.archive(workspaceId, session.user.id, projectId, archived);
    revalidatePath(`/app/workspace/${workspaceId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update the project.");
  }
}

// ---------------------------------------------------------------------------
// Analytics (server data access for the dashboard)
// ---------------------------------------------------------------------------

export type WorkspaceOverview = Awaited<ReturnType<typeof analyticsService.workspaceOverview>>;

export async function getWorkspaceAnalyticsAction(workspaceId: string): Promise<{
  overview: Awaited<ReturnType<typeof analyticsService.workspaceOverview>>;
  burndown: Awaited<ReturnType<typeof analyticsService.burndown>>;
  productivity: Awaited<ReturnType<typeof analyticsService.memberProductivity>>;
  trend: Awaited<ReturnType<typeof analyticsService.dailyTrend>>;
}> {
  const session = await requireSession();
  const [overview, burndown, productivity, trend] = await Promise.all([
    analyticsService.workspaceOverview(workspaceId, session.user.id),
    analyticsService.burndown(workspaceId, session.user.id, 14),
    analyticsService.memberProductivity(workspaceId, session.user.id),
    analyticsService.dailyTrend(workspaceId, session.user.id, 14),
  ]);
  return { overview, burndown, productivity, trend };
}

/** Board shape shipped over the wire is JSON-serializable. */
export type BoardPayload = Prisma.PromiseReturnType<typeof projectService.getBoard>;