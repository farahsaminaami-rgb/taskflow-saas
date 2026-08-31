import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import type { NotificationType } from "@prisma/client";

export interface CreateNotificationInput {
  workspaceId: string;
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  message?: string | null;
  taskId?: string | null;
  projectId?: string | null;
  data?: Record<string, unknown>;
}

export class NotificationService {
  private async memberOf(workspaceId: string, userId: string) {
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m || m.status !== "ACTIVE") throw new AuthError("You are not a member of this workspace.", 403);
    return m;
  }

  async create(input: CreateNotificationInput) {
    if (input.recipientId === input.actorId) return null; // no self-notifications
    return prisma.notification.create({
      data: {
        workspaceId: input.workspaceId,
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        message: input.message ?? null,
        taskId: input.taskId ?? null,
        projectId: input.projectId ?? null,
        data: (input.data ?? {}) as unknown as object,
      },
    });
  }

  async createMany(inputs: CreateNotificationInput[]) {
    const filtered = inputs.filter((i) => i.recipientId !== i.actorId);
    if (!filtered.length) return 0;
    await prisma.notification.createMany({
      data: filtered.map((i) => ({
        workspaceId: i.workspaceId,
        recipientId: i.recipientId,
        actorId: i.actorId ?? null,
        type: i.type,
        title: i.title,
        message: i.message ?? null,
        taskId: i.taskId ?? null,
        projectId: i.projectId ?? null,
        data: (i.data ?? {}) as unknown as object,
      })),
    });
    return filtered.length;
  }

  /** Cursor-paginated inbox for the current user within a workspace. */
  async listForUser(workspaceId: string, userId: string, cursor?: string, limit = 20) {
    await this.memberOf(workspaceId, userId);
    return prisma.notification.findMany({
      where: { workspaceId, recipientId: userId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, name: true, image: true } },
      },
    });
  }

  async unreadCount(workspaceId: string, userId: string): Promise<number> {
    return prisma.notification.count({
      where: { workspaceId, recipientId: userId, isRead: false },
    });
  }

  async markRead(workspaceId: string, userId: string, ids: string[], all = false) {
    await this.memberOf(workspaceId, userId);
    if (all) {
      await prisma.notification.updateMany({
        where: { workspaceId, recipientId: userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return;
    }
    await prisma.notification.updateMany({
      where: { id: { in: ids }, workspaceId, recipientId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** Present a Time-based feed of the last N activity entries. */
  async recentActivity(workspaceId: string, userId: string, limit = 30) {
    await this.memberOf(workspaceId, userId);
    return prisma.activityLog.findMany({
      where: { workspaceId },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true, image: true } } },
    });
  }
}

export const notificationService = new NotificationService();