import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugSchema, type CreateWorkspaceInput, type UpdateWorkspaceInput } from "@/lib/validators/workspace";
import { AuthError } from "@/lib/auth-gate";
import { FREE_PLAN } from "@/lib/plans";

/**
 * Workspace service — all operations are scoped to a caller identity
 * (`userId`) and the workspace is either created by the user or their
 * membership is verified before any read/write.
 */
export class WorkspaceService {
  async create(userId: string, input: CreateWorkspaceInput) {
    const data = {
      ...input,
      slug: input.slug.toLowerCase(),
    };
    slugSchema.parse(data.slug);

    const slugTaken = await prisma.workspace.findUnique({ where: { slug: data.slug } });
    if (slugTaken) {
      throw new AuthError("That workspace URL is already taken. Try another one.", 409);
    }

    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          ownerId: userId,
          plan: "FREE",
          maxMembers: FREE_PLAN.maxMembers ?? 5,
          maxProjects: FREE_PLAN.maxProjects ?? 3,
          maxTasksPerProject: FREE_PLAN.maxTasksPerProject ?? 100,
          members: {
            create: { userId, role: UserRole.OWNER, status: "ACTIVE" },
          },
          subscription: {
            create: {
              plan: "FREE",
              status: "ACTIVE",
              seats: 1,
            },
          },
        },
        include: { members: { where: { userId } } },
      });

      return workspace;
    });
  }

  async listForUser(userId: string) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        role: true,
        workspace: {
          select: { id: true, name: true, slug: true, logoUrl: true, plan: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  }

  /** Resolve a workspace + caller's role in it. */
  async getForUser(userId: string, workspaceId: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new AuthError("Workspace not found or you are not a member.", 404);
    }
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new AuthError("Workspace not found.", 404);
    return { workspace, role: membership.role };
  }

  async update(userId: string, workspaceId: string, input: UpdateWorkspaceInput) {
    // Only admins/owners may edit workspace settings.
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new AuthError("You do not have access to this workspace.", 403);
    }
    if (!["ADMIN", "OWNER"].includes(membership.role)) {
      throw new AuthError("Only admins can update workspace settings.", 403);
    }

    const data: Record<string, unknown> = {};
    if (input.name) data.name = input.name;
    if (input.slug) {
      const slug = input.slug.toLowerCase();
      slugSchema.parse(slug);
      const clash = await prisma.workspace.findFirst({
        where: { slug, id: { not: workspaceId } },
      });
      if (clash) throw new AuthError("That workspace URL is already taken.", 409);
      data.slug = slug;
    }
    if (input.description !== undefined) data.description = input.description || null;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });

    await this.logActivity(workspaceId, userId, "workspace.updated", "workspace", workspaceId, {
      ...data,
    });

    return workspace;
  }

  async logActivity(
    workspaceId: string,
    actorId: string,
    action: string,
    entityType: string,
    entityId?: string,
    meta?: Record<string, unknown>
  ) {
    return prisma.activityLog.create({
      data: {
        workspaceId,
        actorId,
        action,
        entityType,
        entityId,
        meta: (meta ?? {}) as object,
      },
    });
  }
}

export const workspaceService = new WorkspaceService();