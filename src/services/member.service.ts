import { randomBytes } from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import { assertMemberLimit } from "@/lib/plans";
import { sendMail, buildInviteEmail } from "@/lib/mail";
import { env } from "@/lib/env";
import type { InviteMemberInput } from "@/lib/validators/workspace";
import { dispatchEvent } from "@/lib/realtime/dispatch";

const INVITE_TTL_DAYS = 7;

export class MemberService {
  /** Role-gated invite by email with plan-limit enforcement. */
  async inviteByEmail(workspaceId: string, actorId: string, input: InviteMemberInput) {
    await this.assertManage(workspaceId, actorId);

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const activeCount = await prisma.workspaceMember.count({
      where: { workspaceId, status: "ACTIVE" },
    });
    const check = assertMemberLimit(workspace.plan, activeCount, 1);
    if (!check.allowed) throw new AuthError(check.reason!, 402);

    const actor = await prisma.user.findUniqueOrThrow({ where: { id: actorId } });
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const email = input.email.toLowerCase();

    // If the invitee already has an account, pre-wire the membership so the
    // invite email becomes the only remaining step.
    const invitee = await prisma.user.findUnique({ where: { email } });
    if (invitee) {
      const alreadyMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: invitee.id } },
      });
      if (alreadyMember?.status === "ACTIVE") {
        throw new AuthError(`${email} is already a member of this workspace.`, 409);
      }
    }

    const invitation = await prisma.invitation.create({
      data: {
        workspaceId,
        email,
        token,
        role: input.role,
        kind: "EMAIL",
        invitedById: actorId,
        expiresAt,
      },
    });

    const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
    const { subject, html } = buildInviteEmail({
      workspaceName: workspace.name,
      inviterName: actor.name ?? "A teammate",
      inviteUrl,
      role: input.role,
    });
    await sendMail({ to: email, subject, html });

    return invitation;
  }

  /** Generate a shareable invite link (no email required). */
  async createInviteLink(workspaceId: string, actorId: string, role: UserRole) {
    await this.assertManage(workspaceId, actorId);
    const token = randomBytes(32).toString("hex");
    await prisma.invitation.create({
      data: {
        workspaceId,
        token,
        role,
        kind: "LINK",
        invitedById: actorId,
        status: "PENDING",
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    return { url: `${env.NEXT_PUBLIC_APP_URL}/invite/${token}` };
  }

  /** Accept an invitation token — creates (or reactivates) the membership. */
  async accept(token: string, userId: string) {
    const invitation = await prisma.invitation.findUnique({ where: { token } });
    if (!invitation) throw new AuthError("This invitation is invalid or has expired.", 404);
    if (invitation.status !== "PENDING") throw new AuthError("This invitation has already been used.", 409);
    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw new AuthError("This invitation has expired.", 410);
    }
    if (invitation.email && invitation.email !== (await prisma.user.findUnique({ where: { id: userId } }))?.email) {
      throw new AuthError("This invitation was sent to a different email address.", 403);
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
      });

      const membership = existing
        ? await tx.workspaceMember.update({
            where: { id: existing.id },
            data: { status: "ACTIVE", role: existing.role === "VIEWER" ? invitation.role : existing.role },
          })
        : await tx.workspaceMember.create({
            data: {
              workspaceId: invitation.workspaceId,
              userId,
              role: invitation.role,
              status: "ACTIVE",
            },
          });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedById: userId, respondedAt: new Date() },
      });

      await this.notifyOwnerOnJoin(tx, invitation.workspaceId, userId);
      return membership;
    });
  }

  async listInvitations(workspaceId: string, actorId: string) {
    await this.assertAccess(workspaceId, actorId);
    return prisma.invitation.findMany({
      where: { workspaceId, status: "PENDING" },
      include: { invitedBy: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeInvitation(workspaceId: string, actorId: string, invitationId: string) {
    await this.assertManage(workspaceId, actorId);
    return prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });
  }

  async updateRole(workspaceId: string, actorId: string, memberId: string, role: UserRole) {
    const actor = await this.assertManage(workspaceId, actorId);
    const target = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
    if (!target || target.workspaceId !== workspaceId) {
      throw new AuthError("Member not found in this workspace.", 404);
    }
    if (actor.role !== "OWNER" && target.role === "OWNER") {
      throw new AuthError("Only the workspace owner can change the owner's role.", 403);
    }
    if (target.userId === actorId && role !== actor.role) {
      throw new AuthError("You cannot change your own role.", 403);
    }
    return prisma.workspaceMember.update({ where: { id: memberId }, data: { role } });
  }

  async removeMember(workspaceId: string, actorId: string, memberId: string) {
    const actor = await this.assertManage(workspaceId, actorId);
    const target = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
    if (!target || target.workspaceId !== workspaceId) {
      throw new AuthError("Member not found in this workspace.", 404);
    }
    const activeOwners = await prisma.workspaceMember.count({
      where: { workspaceId, role: "OWNER", status: "ACTIVE" },
    });
    if (target.role === "OWNER" && activeOwners <= 1) {
      throw new AuthError("A workspace needs at least one owner.", 409);
    }
    if (actor.role !== "OWNER" && target.role === "OWNER") {
      throw new AuthError("Only the workspace owner can remove the owner.", 403);
    }
    await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { status: "REVOKED", leftAt: new Date() },
    });
    await dispatchEvent({
      type: "member.left",
      workspaceId,
      actorId,
      data: { memberId, userId: target.userId },
    });
  }

  async leave(workspaceId: string, userId: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) throw new AuthError("You are not a member.", 404);
    if (membership.role === "OWNER") {
      const owners = await prisma.workspaceMember.count({
        where: { workspaceId, role: "OWNER", status: "ACTIVE" },
      });
      if (owners <= 1) throw new AuthError("Transfer ownership before leaving the workspace.", 409);
    }
    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.update({ where: { id: membership.id }, data: { status: "REVOKED", leftAt: new Date() } });
      await tx.activeTimer.deleteMany({ where: { workspaceId, userId } });
    });
    await dispatchEvent({ type: "member.left", workspaceId, actorId: userId, data: { memberId: membership.id, userId } });
  }

  async listMembers(workspaceId: string, actorId: string) {
    await this.assertAccess(workspaceId, actorId);
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });
    return members.map((m) => ({ id: m.id, role: m.role, joinedAt: m.joinedAt, user: m.user }));
  }

  // -------------------------------------------------------------------------

  private async assertAccess(workspaceId: string, actorId: string) {
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actorId } },
    });
    if (!m || m.status !== "ACTIVE") throw new AuthError("You are not a member of this workspace.", 403);
    return m;
  }

  private async assertManage(workspaceId: string, actorId: string) {
    const m = await this.assertAccess(workspaceId, actorId);
    if (!["ADMIN", "OWNER"].includes(m.role)) {
      throw new AuthError("Only admins can manage members.", 403);
    }
    return m;
  }

  private async notifyOwnerOnJoin(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    workspaceId: string,
    joiningUserId: string
  ) {
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const joiner = await tx.user.findUniqueOrThrow({ where: { id: joiningUserId } });
    await tx.notification.create({
      data: {
        workspaceId,
        recipientId: workspace.ownerId,
        actorId: joiningUserId,
        type: "MEMBER_JOINED",
        title: `${joiner.name ?? "Someone"} joined your workspace`,
        message: `${joiner.name ?? "Someone"} joined ${workspace.name}.`,
        isRead: false,
      },
    });
  }
}

export const memberService = new MemberService();