"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth-gate";
import { workspaceService } from "@/services/workspace.service";
import { createWorkspaceSchema, updateWorkspaceSchema } from "@/lib/validators/workspace";
import { ActionResult, fail, ok } from "@/lib/validators";

const ACTIVE_WORKSPACE_COOKIE = "active-workspace";

export async function createWorkspaceAction(input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const session = await requireSession();
    const parsed = createWorkspaceSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join(".")] = [...(fieldErrors[issue.path.join(".")] ?? []), issue.message];
      }
      return fail("Please fix the highlighted fields.", fieldErrors);
    }

    const workspace = await workspaceService.create(session.user.id, parsed.data);
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    revalidatePath("/app");
    return ok({ id: workspace.id, slug: workspace.slug });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create workspace.");
  }
}

export async function switchWorkspaceAction(workspaceId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await workspaceService.getForUser(session.user.id, workspaceId); // membership check
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    revalidatePath("/app");
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to switch workspace.");
  }
}

export async function updateWorkspaceAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const session = await requireSession();
    const parsed = updateWorkspaceSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid workspace data.");
    const updated = await workspaceService.update(session.user.id, workspaceId, parsed.data);
    revalidatePath(`/app/workspace/${updated.slug}/settings`);
    return ok({ id: updated.id, slug: updated.slug });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save workspace.");
  }
}