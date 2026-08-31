import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import { addCommentSchema } from "@/lib/validators/task";
import { dispatchEvent } from "@/lib/realtime/dispatch";

export class CommentService {
  private async assertMember(workspaceId: string, userId: string) {
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m || m.status !== "ACTIVE") throw new AuthError("You are not a member of this workspace.", 403);
    return m;
  }

  async add(workspaceId: string, userId: string, raw: { taskId: string; body: string }) {
    const input = addCommentSchema.parse(raw);
    await this.assertMember(workspaceId, userId);

    const task = await prisma.task.findFirst({ where: { id: input.taskId, workspaceId } });
    if (!task) throw new AuthError("Task not found.", 404);

    const comment = await prisma.comment.create({
      data: {
        workspaceId,
        taskId: task.id,
        authorId: userId,
        body: input.body,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    // Notify assignees (not the author) that something was said.
    const assignees = await prisma.taskAssignment.findMany({
      where: { taskId: task.id, workspaceId, userId: { not: userId } },
      select: { userId: true },
    });
    const author = await prisma.user.findUnique({ where: { id: userId } });
    for (const a of assignees) {
      await prisma.notification.create({
        data: {
          workspaceId,
          recipientId: a.userId,
          actorId: userId,
          type: "TASK_COMMENTED",
          title: `${author?.name ?? "Someone"} commented on "${task.title}"`,
          message: input.body.length > 120 ? `${input.body.slice(0, 120)}…` : input.body,
          taskId: task.id,
          projectId: task.projectId,
          data: {},
        },
      });
    }

    await dispatchEvent({
      type: "comment.added",
      workspaceId,
      actorId: userId,
      projectId: task.projectId,
      data: {
        taskId: task.id,
        comment: {
          id: comment.id,
          body: comment.body,
          authorId: userId,
          authorName: author?.name ?? null,
          authorImage: author?.image ?? null,
          createdAt: comment.createdAt.toISOString(),
        },
      },
    });

    return comment;
  }

  async update(workspaceId: string, userId: string, commentId: string, body: string) {
    await this.assertMember(workspaceId, userId);
    const comment = await prisma.comment.findFirst({ where: { id: commentId, workspaceId } });
    if (!comment) throw new AuthError("Comment not found.", 404);
    if (comment.authorId !== userId) throw new AuthError("You can only edit your own comments.", 403);

    return prisma.comment.update({
      where: { id: commentId },
      data: { body, editedAt: new Date() },
    });
  }

  async remove(workspaceId: string, userId: string, commentId: string) {
    const membership = await this.assertMember(workspaceId, userId);
    const comment = await prisma.comment.findFirst({ where: { id: commentId, workspaceId } });
    if (!comment) throw new AuthError("Comment not found.", 404);
    const isOwner = comment.authorId === userId;
    const isModerator = membership.role === "ADMIN" || membership.role === "OWNER";
    if (!isOwner && !isModerator) throw new AuthError("You cannot delete this comment.", 403);

    await prisma.comment.delete({ where: { id: commentId } });
  }

  async list(workspaceId: string, userId: string, taskId: string) {
    await this.assertMember(workspaceId, userId);
    return prisma.comment.findMany({
      where: { taskId, workspaceId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true, image: true } } },
    });
  }
}

export const commentService = new CommentService();