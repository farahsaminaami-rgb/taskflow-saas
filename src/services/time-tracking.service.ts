import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import { addManualTimeEntrySchema, startTimeTrackingSchema } from "@/lib/validators/task";

export class TimeTrackingService {
  private async assertMember(workspaceId: string, userId: string) {
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m || m.status !== "ACTIVE") throw new AuthError("You are not a member of this workspace.", 403);
    return m;
  }

  private async tenantTask(workspaceId: string, taskId: string) {
    const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!task) throw new AuthError("Task not found.", 404);
    return task;
  }

  /** Start (or resume) a timer against a task. Only one active per user. */
  async startTimer(workspaceId: string, userId: string, taskId: string) {
    startTimeTrackingSchema.parse({ taskId });
    await this.assertMember(workspaceId, userId);
    await this.tenantTask(workspaceId, taskId);

    const existing = await prisma.activeTimer.findUnique({ where: { userId } });
    if (existing) {
      // Don't silently overwrite — surface to the caller so the UI can confirm.
      throw new AuthError("You already have a running timer.", 409);
    }

    return prisma.activeTimer.create({
      data: { workspaceId, userId, taskId, startedAt: new Date() },
    });
  }

  /** Stop the active timer and persist elapsed time as a TimeEntry. */
  async stopTimer(workspaceId: string, userId: string, note?: string) {
    const timer = await prisma.activeTimer.findUnique({ where: { userId } });
    if (!timer || timer.workspaceId !== workspaceId) {
      throw new AuthError("No active timer to stop in this workspace.", 404);
    }

    const seconds = Math.max(1, Math.round((Date.now() - timer.startedAt.getTime()) / 1000));
    const minutes = Math.max(1, Math.round(seconds / 60));

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.timeEntry.create({
        data: {
          workspaceId,
          taskId: timer.taskId,
          userId,
          minutes,
          source: "TIMER",
          note: note ?? null,
          startedAt: timer.startedAt,
          endedAt: new Date(),
        },
      });
      await tx.activeTimer.delete({ where: { id: timer.id } });
      return created;
    });

    return { entry, minutes };
  }

  /** Admin actor can stop timers owned by another member of the workspace. */
  async listActive(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    return prisma.activeTimer.findMany({
      where: { workspaceId },
      include: {
        task: { select: { id: true, title: true } },
      },
    });
  }

  async addManualEntry(workspaceId: string, userId: string, raw: { taskId: string; minutes: number; note?: string }) {
    const input = addManualTimeEntrySchema.parse(raw);
    await this.assertMember(workspaceId, userId);
    await this.tenantTask(workspaceId, input.taskId);

    return prisma.timeEntry.create({
      data: {
        workspaceId,
        taskId: input.taskId,
        userId,
        minutes: input.minutes,
        source: "MANUAL",
        note: input.note ?? null,
        startedAt: new Date(),
        endedAt: new Date(Date.now() + input.minutes * 60_000),
      },
    });
  }

  /** Total tracked minutes for a task (all members). */
  async taskTotalMinutes(workspaceId: string, taskId: string): Promise<number> {
    const agg = await prisma.timeEntry.aggregate({
      where: { workspaceId, taskId },
      _sum: { minutes: true },
    });
    return agg._sum.minutes ?? 0;
  }

  /** Per-user totals in a workspace for the analytics dashboard. */
  async workspaceTotals(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);

    const [byMember, totalAgg, byDay] = await Promise.all([
      prisma.timeEntry.groupBy({
        by: ["userId"],
        where: { workspaceId },
        _sum: { minutes: true },
        _count: { _all: true },
      }),
      prisma.timeEntry.aggregate({
        where: { workspaceId },
        _sum: { minutes: true },
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ day: Date; total_minutes: number }>>`
        SELECT date_trunc('day', "startedAt" at time zone 'UTC') as day,
               SUM(minutes) as total_minutes
        FROM time_entries
        WHERE "workspaceId" = ${workspaceId}::uuid
        GROUP BY 1 ORDER BY 1 DESC LIMIT 30
      `,
    ]);

    return { byMember, total: totalAgg._sum.minutes ?? 0, entries: totalAgg._count._all, byDay };
  }
}

export const timeTrackingService = new TimeTrackingService();