import { NotificationType, Task, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import { assertTaskLimit } from "@/lib/plans";
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  type CreateTaskInput,
} from "@/lib/validators/task";
import { dispatchEvent } from "@/lib/realtime/dispatch";
import { workspaceService } from "./workspace.service";

/**
 * Task service — the tenant boundary is enforced by pairing `workspaceId`
 * with a membership check and by ALWAYS filtering the workspaceId on every
 * nested lookup (findFirst not findUnique; relation filters by membership).
 */
export class TaskService {
  private async assertMember(workspaceId: string, userId: string, roles: string[] = ["ADMIN", "OWNER", "MEMBER"]) {
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m || m.status !== "ACTIVE") throw new AuthError("You are not a member of this workspace.", 403);
    if (!roles.includes(m.role)) throw new AuthError("You do not have permission to do that.", 403);
    return m;
  }

  async create(workspaceId: string, userId: string, raw: CreateTaskInput) {
    const input = createTaskSchema.parse(raw);
    await this.assertMember(workspaceId, userId);

    const project = await prisma.project.findFirst({
      where: { id: input.projectId, workspaceId },
    });
    if (!project) throw new AuthError("Project not found.", 404);

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const currentCount = await prisma.task.count({ where: { workspaceId, projectId: input.projectId } });
    const limit = assertTaskLimit(workspace.plan, currentCount);
    if (!limit.allowed) throw new AuthError(limit.reason!, 402);

    // Resolve target column (own or the board's "To Do") within the tenant.
    const columnId = input.columnId ?? (await this.defaultColumnId(workspaceId, input.projectId));
    const column = await prisma.statusColumn.findFirst({
      where: { id: columnId, workspaceId, projectId: input.projectId },
    });
    if (!column) throw new AuthError("Column not found.", 404);

    const position = await prisma.task.count({ where: { workspaceId, columnId } });

    const members = await this.memberUsersByIds(workspaceId, input.assigneeIds);

    const task = await prisma.task.create({
      data: {
        workspaceId,
        projectId: input.projectId,
        columnId,
        createdById: userId,
        title: input.title,
        description: input.description || null,
        priority: input.priority,
        dueAt: input.dueAt ?? null,
        position,
        assignees: { create: members.map((m) => ({ workspaceId, userId: m.id })) },
        tags: input.tagIds.length
          ? { create: input.tagIds.map((tagId) => ({ workspaceId, tagId })) }
          : undefined,
      },
      include: taskInclude,
    });

    for (const assignee of members) {
      await this.notify(workspaceId, {
        recipientId: assignee.id,
        actorId: userId,
        type: "TASK_ASSIGNED",
        title: `You were assigned to "${task.title}"`,
        message: `${project.key}-${task.id.slice(0, 4).toUpperCase()} · ${task.title}`,
        taskId: task.id,
        projectId: project.id,
      });
    }

    await workspaceService.logActivity(workspaceId, userId, "task.created", "task", task.id, {
      title: task.title,
      projectId: project.id,
    });

    await dispatchEvent({
      type: "task.created",
      workspaceId,
      actorId: userId,
      projectId: project.id,
      data: { task: this.toDndTask(task), columnId },
    });

    return task;
  }

  async update(workspaceId: string, userId: string, taskId: string, raw: Partial<CreateTaskInput>) {
    const input = updateTaskSchema.partial().parse(raw);
    await this.assertMember(workspaceId, userId);

    const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId }, include: taskInclude });
    if (!task) throw new AuthError("Task not found.", 404);
    const assigneeIds = input.assigneeIds;
    const tagIds = input.tagIds;

    return prisma.$transaction(async (tx) => {
      const changed = await tx.task.update({
        where: { id: taskId },
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueAt: input.dueAt !== undefined ? input.dueAt : undefined,
        },
        include: taskInclude,
      });

      if (assigneeIds) {
        await tx.taskAssignment.deleteMany({ where: { taskId, workspaceId } });
        const members = await this.memberUsersByIds(workspaceId, assigneeIds);
        if (members.length) {
          await tx.taskAssignment.createMany({
            data: members.map((m) => ({ taskId, workspaceId, userId: m.id })),
          });
        }
        for (const m of members) {
          const previouslyAssigned = task.assignees.some((a: { userId: string }) => a.userId === m.id);
          if (!previouslyAssigned) {
            await this.notify(workspaceId, {
              recipientId: m.id,
              actorId: userId,
              type: "TASK_ASSIGNED",
              title: `You were assigned to "${changed.title}"`,
              message: `${task.title}`,
              taskId,
              projectId: task.projectId,
            });
          }
        }
      }

      if (tagIds) {
        await tx.taskTagRelation.deleteMany({ where: { taskId, workspaceId } });
        if (tagIds.length) {
          await tx.taskTagRelation.createMany({
            data: tagIds.map((tagId) => ({ taskId, workspaceId, tagId })),
          });
        }
      }

      await workspaceService.logActivity(workspaceId, userId, "task.updated", "task", taskId, {
        fields: Object.keys(input).filter((k) => !["assigneeIds", "tagIds"].includes(k)),
      });

      return tx.task.findUniqueOrThrow({
        where: { id: taskId },
        include: taskInclude,
      });
    }).then(async (full) => {
      await dispatchEvent({
        type: "task.updated",
        workspaceId,
        actorId: userId,
        projectId: full.projectId,
        data: { task: this.toDndTask(full) },
      });
      return full;
    });
  }

  /** Move a task across columns with positional rebalancing. */
  async move(workspaceId: string, userId: string, input: { taskId: string; columnId: string; position: number }) {
    const parsed = moveTaskSchema.parse(input);
    await this.assertMember(workspaceId, userId);

    const task = await prisma.task.findFirst({ where: { id: parsed.taskId, workspaceId }, include: taskInclude });
    if (!task) throw new AuthError("Task not found.", 404);

    const toColumn = await prisma.statusColumn.findFirst({
      where: { id: parsed.columnId, workspaceId, projectId: task.projectId },
    });
    if (!toColumn) throw new AuthError("Destination column not found.", 404);

    const fromColumnId = task.columnId;

    return prisma.$transaction(async (tx) => {
      const position = Math.max(0, Math.min(parsed.position, await tx.task.count({ where: { workspaceId, columnId: toColumn.id } })));

      if (toColumn.id === fromColumnId) {
        // Reorder within the same column.
        const movingUp = position < task.position;
        await tx.task.updateMany({
          where: { workspaceId, columnId: toColumn.id, id: { not: task.id }, position: movingUp ? { gte: position } : { lt: task.position } },
          data: { position: { increment: movingUp ? 1 : -1 } },
        });
        await prisma.task.update({ where: { id: task.id }, data: { position } });
      } else {
        // Shift destination, compress source, then place at its slot.
        await tx.task.updateMany({
          where: { workspaceId, columnId: toColumn.id, position: { gte: position } },
          data: { position: { increment: 1 } },
        });
        await tx.task.updateMany({
          where: { workspaceId, columnId: fromColumnId, position: { gt: task.position } },
          data: { position: { decrement: 1 } },
        });
        const completedAt = toColumn.category === "DONE" ? new Date() : null;
        await tx.task.update({
          where: { id: task.id },
          data: { columnId: toColumn.id, position, completedAt, startedAt: null },
        });
      }

      const updated = await tx.task.findUniqueOrThrow({
        where: { id: task.id },
        include: taskInclude,
      });

      if (toColumn.category === "DONE" && fromColumnId !== toColumn.id) {
        await this.notify(
          workspaceId,
          task.assignees.map((a: { userId: string }) => ({
            recipientId: a.userId,
            actorId: userId,
            type: "TASK_STATUS_CHANGED" as const,
            title: `"${updated.title}" is done 🎉`,
            message: `${task.title} was moved to ${toColumn.name}.`,
            taskId: task.id,
            projectId: task.projectId,
          }))
        );
      }

      return updated;
    }).then(async (full) => {
      await dispatchEvent({
        type: "task.moved",
        workspaceId,
        actorId: userId,
        projectId: full.projectId,
        data: {
          taskId: full.id,
          fromColumnId,
          toColumnId: full.columnId,
          position: full.position,
          actorId: userId,
        },
      });
      return full;
    });
  }

  /** Batch-reorder used after drag ends (fallback path). */
  async reorder(workspaceId: string, userId: string, order: Array<{ id: string; position: number }>) {
    await this.assertMember(workspaceId, userId);
    return prisma.$transaction(
      order.map((o) => prisma.task.updateMany({ where: { id: o.id, workspaceId }, data: { position: o.position } }))
    );
  }

  async list(workspaceId: string, userId: string, projectId: string) {
    await this.assertMember(workspaceId, userId);
    return prisma.task.findMany({
      where: { workspaceId, projectId, isArchived: false },
      orderBy: [{ columnId: "asc" }, { position: "asc" }],
      include: taskInclude,
    });
  }

  async getById(workspaceId: string, userId: string, taskId: string) {
    await this.assertMember(workspaceId, userId);
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: {
        ...taskInclude,
        comments: { orderBy: { createdAt: "asc" }, include: commenterInclude },
        attachments: true,
        mentions: { select: { user: { select: { id: true, name: true, email: true } } } },
        timeEntries: { orderBy: { startedAt: "desc" } },
        project: { select: { id: true, name: true, key: true, color: true } },
      },
    });
    if (!task) throw new AuthError("Task not found.", 404);
    return task;
  }

  async archive(workspaceId: string, userId: string, taskId: string, archived = true) {
    await this.assertMember(workspaceId, userId);
    const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!task) throw new AuthError("Task not found.", 404);

    const updated = await prisma.task.update({ where: { id: taskId }, data: { isArchived: archived } });
    await dispatchEvent({
      type: archived ? "task.archived" : "task.updated",
      workspaceId,
      actorId: userId,
      projectId: task.projectId,
      data: { task: { id: taskId, isArchived: archived } },
    });
    return updated;
  }

  async remove(workspaceId: string, userId: string, taskId: string) {
    await this.assertMember(workspaceId, userId, ["ADMIN", "OWNER"]);
    const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!task) throw new AuthError("Task not found.", 404);

    await prisma.$transaction([
      prisma.task.delete({ where: { id: taskId } }),
      prisma.activityLog.create({
        data: {
          workspaceId,
          actorId: userId,
          action: "task.deleted",
          entityType: "task",
          entityId: taskId,
          meta: { title: task.title },
        },
      }),
    ]);

    await dispatchEvent({
      type: "task.deleted",
      workspaceId,
      actorId: userId,
      projectId: task.projectId,
      data: { taskId },
    });
  }

  // -------------------------------------------------------------------------

  private async defaultColumnId(workspaceId: string, projectId: string): Promise<string> {
    const col = await prisma.statusColumn.findFirst({
      where: { workspaceId, projectId, category: "TODO", isArchived: false },
      orderBy: { position: "asc" },
    });
    if (!col) {
      const any = await prisma.statusColumn.findFirst({
        where: { workspaceId, projectId, isArchived: false },
        orderBy: { position: "asc" },
      });
      if (!any) throw new AuthError("This project has no columns. Create a column first.", 400);
      return any.id;
    }
    return col.id;
  }

  private async memberUsersByIds(workspaceId: string, userIds: string[]) {
    if (!userIds.length) return [];
    return prisma.user.findMany({
      where: {
        id: { in: userIds },
        memberships: { some: { workspaceId, status: "ACTIVE" } },
      },
      select: { id: true, name: true, email: true, image: true },
    });
  }

  private async notify(
    workspaceId: string,
    notifications:
      | Array<{
          recipientId: string;
          actorId: string;
          type: NotificationType;
          title: string;
          message?: string;
          taskId?: string;
          projectId?: string;
        }>
      | {
          recipientId: string;
          actorId: string;
          type: NotificationType;
          title: string;
          message?: string;
          taskId?: string;
          projectId?: string;
        }
  ) {
    const list = Array.isArray(notifications) ? notifications : [notifications];
    if (!list.length) return;

    // Ignore self-notifications and `(workspaceId, recipientId)` dupes.
    const unique = new Map(
      list
        .filter((n) => n.recipientId !== n.actorId)
        .map((n) => [n.recipientId, n])
    );
    if (!unique.size) return;

    for (const n of unique.values()) {
      await prisma.notification.create({
        data: {
          workspaceId,
          recipientId: n.recipientId,
          actorId: n.actorId,
          type: n.type,
          title: n.title,
          message: n.message ?? null,
          taskId: n.taskId ?? null,
          projectId: n.projectId ?? null,
          data: {},
        },
      });
    }
    await dispatchEvent({
      type: "notification.created",
      workspaceId,
      actorId: list[0].actorId,
      data: { count: unique.size },
    });
  }

  /** Compact task shape for optimistic DnD merging on other clients. */
  private toDndTask(task: Task & { assignees?: unknown[]; tags?: unknown[] }) {
    return {
      id: task.id,
      title: task.title,
      columnId: task.columnId,
      position: task.position,
      priority: task.priority,
      dueAt: task.dueAt,
      completedAt: task.completedAt,
      updatedAt: task.updatedAt,
    };
  }
}

const commenterInclude = {
  author: { select: { id: true, name: true, image: true } },
} satisfies Prisma.CommentInclude;

export const taskInclude = {
  assignees: {
    include: { user: { select: { id: true, name: true, image: true, email: true } } },
  },
  tags: {
    include: { tag: { select: { id: true, name: true, color: true } } },
  },
  _count: { select: { comments: true, attachments: true, timeEntries: true } },
} satisfies Prisma.TaskInclude;

export const taskService = new TaskService();