"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-gate";
import { memberService } from "@/services/member.service";
import { projectService } from "@/services/project.service";
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
} from "@/lib/validators/workspace";
import { ActionResult, fail, ok } from "@/lib/validators";

type ActionResultRaw<T = undefined> = ActionResult<T>;

export async function inviteMemberAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResultRaw<{ id: string; email: string; role: string }>> {
  try {
    const session = await requireSession();
    const parsed = inviteMemberSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid invite details.");
    const invitation = await memberService.inviteByEmail(workspaceId, session.user.id, parsed.data);
    revalidatePath(`/app/workspace/${workspaceId}/members`);
    return ok({ id: invitation.id, email: invitation.email!, role: invitation.role });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to send the invitation.");
  }
}

export async function createInviteLinkAction(
  workspaceId: string,
  role: unknown
): Promise<ActionResultRaw<{ url: string }>> {
  try {
    const session = await requireSession();
    const parsedRole = updateMemberRoleSchema.shape.role.safeParse(role);
    if (!parsedRole.success) return fail("Invalid role.");
    const { url } = await memberService.createInviteLink(workspaceId, session.user.id, parsedRole.data);
    return ok({ url });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create the invite link.");
  }
}

export async function acceptInvitationAction(token: string): Promise<ActionResultRaw<{ workspaceId: string }>> {
  try {
    const session = await requireSession();
    const membership = await memberService.accept(token, session.user.id);
    return ok({ workspaceId: membership.workspaceId });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to join the workspace.");
  }
}

export async function updateMemberRoleAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResultRaw> {
  try {
    const session = await requireSession();
    const parsed = updateMemberRoleSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid member data.");
    await memberService.updateRole(workspaceId, session.user.id, parsed.data.memberId, parsed.data.role);
    revalidatePath(`/app/workspace/${workspaceId}/members`);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update the member role.");
  }
}

export async function removeMemberAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResultRaw> {
  try {
    const session = await requireSession();
    const parsed = removeMemberSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid member data.");
    await memberService.removeMember(workspaceId, session.user.id, parsed.data.memberId);
    revalidatePath(`/app/workspace/${workspaceId}/members`);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to remove the member.");
  }
}

export async function revokeInvitationAction(
  workspaceId: string,
  invitationId: string
): Promise<ActionResultRaw> {
  try {
    const session = await requireSession();
    await memberService.revokeInvitation(workspaceId, session.user.id, invitationId);
    revalidatePath(`/app/workspace/${workspaceId}/members`);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to revoke the invitation.");
  }
}

export async function leaveWorkspaceAction(workspaceId: string): Promise<ActionResultRaw> {
  try {
    const session = await requireSession();
    await memberService.leave(workspaceId, session.user.id);
    revalidatePath("/app");
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to leave the workspace.");
  }
}

export async function listMembersAction(workspaceId: string) {
  "use server";
  const session = await requireSession();
  return projectService.getMembers(workspaceId, session.user.id);
}