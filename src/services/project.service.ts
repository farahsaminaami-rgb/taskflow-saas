import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import { assertProjectLimit } from "@/lib/plans";
import type { ColumnCategory } from "@prisma/client";
import type { CreateProjectInput } from "@/lib/validators/task";
import { workspaceService } from "./workspace.service";
import { dispatchEvent } from "@/lib/realtime/dispatch";

const FREE_DEFAULT_BOARD = [
  { name: "To Do", category: "TODO" as const, color: "#94a3b8" },
  { name: "In Progress", category: "IN_PROGRESS" as const, color: "#3b82f6" },
  { name: "Review", category: "REVIEW" as const, color: "#f59e0b" },
  { name: "Done", category: "DONE" as const, color: "#22c55e" },
];

export class ProjectService {
  private async assertRole(workspaceId: string, userId: string, roles: string[] = ["ADMIN", "OWNER", "MEMBER"]) {
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m || m.status !== "ACTIVE") throw new AuthError("You are not a member of this workspace.", 403);
    if (!roles.includes(m.role)) throw new AuthError("You do not have permission to do that.", 403);
    return m;
  }

  async create(workspaceId: string, userId: string, input: CreateProjectInput) {
    await this.assertRole(workspaceId, userId, ["ADMIN", "OWNER", "MEMBER"]);

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const activeProjects = await prisma.project.count({
      where: { workspaceId, isArchived: false },
    });
    const limit = assertProjectLimit(workspace.plan, activeProjects);
    if (!limit.allowed) throw new AuthError(limit.reason!, 402);

    const key = input.key.toUpperCase().slice(0, 8);

    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId,
          name: input.name,
          key,
          description: input.description || null,
          color: input.color,
          createdById: userId,
          statusColumns: {
            create: (input.columns?.length
              ? input.columns
              : FREE_DEFAULT_BOARD
            ).map((col, i) => ({
              workspace: { connect: { id: workspaceId } },
              name: col.name,
              category: col.category as ColumnCategory,
              position: i,
              color: "color" in col ? ((col.color as string) ?? "#94a3b8") : "#94a3b8",
              isDefault: false,
            })),
          },
          tags: input.tags?.length
            ? { create: input.tags.map((name) => ({ workspaceId, name, color: "#94a3b8" })) }
            : undefined,
        },
        include: { statusColumns: { orderBy: { position: "asc" } }, tags: true },
      });

      await workspaceService.logActivity(workspaceId, userId, "project.created", "project", project.id, {
        name: project.name,
      });
      await dispatchEvent({
        type: "project.updated",
        workspaceId,
        actorId: userId,
        projectId: project.id,
        data: { project: { id: project.id, name: project.name, key: project.key } },
      });
      return project;
    });
  }

  async list(workspaceId: string, userId: string, includeArchived = false) {
    await this.assertRole(workspaceId, userId);
    return prisma.project.findMany({
      where: { workspaceId, isArchived: includeArchived ? undefined : false },
      include: {
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(workspaceId: string, userId: string, projectId: string) {
    await this.assertRole(workspaceId, userId);
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      include: {
        statusColumns: { where: { isArchived: false }, orderBy: { position: "asc" } },
        tags: true,
        tasks: {
          where: { isArchived: false },
          orderBy: [{ columnId: "asc" }, { position: "asc" }],
          include: {
            assignees: { include: { user: { select: { id: true, name: true, image: true } } } },
            tags: { include: { tag: true } },
            timeEntries: { select: { minutes: true } },
            _count: { select: { comments: true, attachments: true, timeEntries: true } },
          },
        },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) throw new AuthError("Project not found.", 404);
    return project;
  }

  /** Full board shape for the client DnD board (lightweight). */
  async getBoard(workspaceId: string, userId: string, projectId: string) {
    await this.assertRole(workspaceId, userId);
    const project = await this.get(workspaceId, userId, projectId);

    const tasks = await prisma.task.findMany({
      where: { workspaceId, projectId, isArchived: false },
      orderBy: { position: "asc" },
      select: {
        id: true,
        title: true,
        columnId: true,
        position: true,
        priority: true,
        dueAt: true,
        completedAt: true,
        createdAt: true,
        assignees: { include: { user: { select: { id: true, name: true, image: true } } } },
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
        timeEntries: { select: { minutes: true } },
        _count: { select: { comments: true, attachments: true, timeEntries: true } },
      },
    });

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId, status: "ACTIVE" },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { joinedAt: "asc" },
    });

    return {
      project: {
        id: project.id,
        name: project.name,
        key: project.key,
        color: project.color,
        tags: project.tags,
      },
      columns: project.statusColumns,
      tasks,
      members,
    };
  }

  async updateColumns(workspaceId: string, userId: string, projectId: string, columns: Array<{
    id?: string;
    name: string;
    category: string;
    color: string;
    position: number;
  }>) {
    await this.assertRole(workspaceId, userId, ["ADMIN", "OWNER", "MEMBER"]);
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    });
    if (!project) throw new AuthError("Project not found.", 404);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.statusColumn.findMany({
        where: { projectId, workspaceId },
        select: { id: true },
      });
      const incomingIds = new Set(columns.map((c) => c.id).filter(Boolean) as string[]);

      for (const stale of existing) {
        if (!incomingIds.has(stale.id)) {
          await tx.statusColumn.update({ where: { id: stale.id }, data: { isArchived: true } });
        }
      }

      for (const col of columns) {
        const payload = {
          workspaceId,
          name: col.name,
          category: col.category as never,
          color: col.color,
          position: col.position,
        };
        if (col.id) {
          await tx.statusColumn.update({ where: { id: col.id }, data: payload });
        } else {
          await tx.statusColumn.create({ data: { ...payload, projectId } });
        }
      }

      await dispatchEvent({
        type: "column.updated",
        workspaceId,
        actorId: userId,
        projectId,
        data: { projectId, columns: columns.map((c) => ({ ...c, position: c.position })) },
      });

      return tx.statusColumn.findMany({
        where: { workspaceId, projectId, isArchived: false },
        orderBy: { position: "asc" },
      });
    });
  }

  async archive(workspaceId: string, userId: string, projectId: string, archived: boolean) {
    await this.assertRole(workspaceId, userId, ["ADMIN", "OWNER"]);
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({ where: { id: projectId, workspaceId } });
      if (!project) throw new AuthError("Project not found.", 404);
      const updated = await tx.project.update({ where: { id: projectId }, data: { isArchived: archived } });
      await tx.task.updateMany({ where: { workspaceId, projectId }, data: { isArchived: archived } });
      return updated;
    });
  }

  async getMembers(workspaceId: string, userId: string) {
    await this.assertRole(workspaceId, userId);
    return prisma.workspaceMember
      .findMany({
        where: { workspaceId, status: "ACTIVE" },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { joinedAt: "asc" },
      })
      .then((rows) => rows.map(({ id: memberId, role, user }) => ({ ...user, id: memberId, role })));
  }
}

export const projectService = new ProjectService();