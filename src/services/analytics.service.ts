import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import { startOfDay, subDays, eachDayOfInterval, format } from "date-fns";

/**
 * Analytics service — read-model queries powering the dashboard charts.
 * All queries are tenant-first: `workspaceId` is always in the WHERE clause.
 */
export class AnalyticsService {
  private async assertMember(workspaceId: string, userId: string) {
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m || m.status !== "ACTIVE") throw new AuthError("You are not a member of this workspace.", 403);
    return m;
  }

  /** High-level workspace metrics for the dashboard. */
  async workspaceOverview(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);

    const [tasksByColumn, tasksByPriority, totalTasks, overdueCount, memberTotals, columns, tags] =
      await Promise.all([
        prisma.task.groupBy({
          by: ["columnId"],
          where: { workspaceId, isArchived: false },
          _count: { _all: true },
        }),
        prisma.task.groupBy({
          by: ["priority"],
          where: { workspaceId, isArchived: false },
          _count: { _all: true },
        }),
        prisma.task.count({ where: { workspaceId, isArchived: false } }),
        prisma.task.count({
          where: {
            workspaceId,
            isArchived: false,
            completedAt: null,
            dueAt: { lt: new Date() },
          },
        }),
        prisma.$queryRaw<Array<{ user_id: string; name: string | null; image: string | null; done: bigint; total: bigint }>>`
          SELECT u.id AS user_id, u.name, u.image,
                 COUNT(*) FILTER (WHERE t."completedAt" IS NOT NULL) AS done,
                 COUNT(*) AS total
          FROM tasks t
          JOIN task_assignments ta ON ta."taskId" = t.id AND ta."workspaceId" = t."workspaceId"
          JOIN users u ON u.id = ta."userId"
          WHERE t."workspaceId" = ${workspaceId}::uuid AND t."isArchived" = false
          GROUP BY u.id, u.name, u.image
          ORDER BY total DESC
          LIMIT 10
        `,
        prisma.statusColumn.findMany({
          where: { workspaceId, isArchived: false },
          orderBy: { position: "asc" },
        }),
        prisma.projectTag.findMany({
          where: { workspaceId },
          orderBy: { name: "asc" },
          take: 30,
        }),
      ]);

    const columnMap = new Map(columns.map((c) => [c.id, c]));
    const byStatus = tasksByColumn.map((row) => ({
      columnId: row.columnId,
      name: columnMap.get(row.columnId)?.name ?? "Deleted column",
      category: columnMap.get(row.columnId)?.category ?? null,
      count: row._count._all,
      color: columnMap.get(row.columnId)?.color ?? "#94a3b8",
    }));

    const byPriority = tasksByPriority.map((row) => ({
      priority: row.priority,
      count: row._count._all,
    }));

    const doneCount = byStatus.find((s) => s.category === "DONE")?.count ?? 0;

    return {
      totalTasks,
      doneCount,
      completionRate: totalTasks ? Math.round((doneCount / totalTasks) * 100) : 0,
      overdueCount,
      byStatus,
      byPriority,
      memberTotals: memberTotals.map((r) => ({
        user: { id: r.user_id, name: r.name, image: r.image },
        done: Number(r.done),
        total: Number(r.total),
      })),
      tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    };
  }

  /** Burn-down for the last N days across a whole workspace. */
  async burndown(workspaceId: string, userId: string, days = 14) {
    await this.assertMember(workspaceId, userId);
    const today = startOfDay(new Date());
    const from = subDays(today, days - 1);

    const rows = await prisma.$queryRaw<Array<{ day: Date; opened: bigint; closed: bigint }>>`
      SELECT
        d.day,
        COUNT(*) FILTER (WHERE t."createdAt"::timestamptz < d.day + interval '1 day') AS opened,
        COUNT(*) FILTER (WHERE t."completedAt" IS NOT NULL AND t."completedAt"::timestamptz < d.day + interval '1 day') AS closed
      FROM tasks t
      CROSS JOIN (
        SELECT generate_series(${from}::timestamptz, ${today}::timestamptz, '1 day')::timestamptz AS day
      ) d
      WHERE t."workspaceId" = ${workspaceId}::uuid AND t."isArchived" = false
        AND t."createdAt"::timestamptz <= d.day + interval '1 day'
      GROUP BY d.day
      ORDER BY d.day ASC
    `;

    return rows.map((row) => {
      const opened = Number(row.opened);
      const closed = Number(row.closed);
      return {
        day: row.day.toISOString().slice(0, 10),
        opened,
        closed,
        remaining: Math.max(0, opened - closed),
      };
    });
  }

  /**
   * Member productivity: items completed + logged time per member over the
   * current calendar week, rendered as a stacked bar in the dashboard.
   */
  async memberProductivity(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    const today = startOfDay(new Date());
    const from = subDays(today, 7);

    const [completions, time] = await Promise.all([
      prisma.task.findMany({
        where: { workspaceId, completedAt: { gte: from }, isArchived: false },
        select: {
          completedAt: true,
          assignees: { select: { userId: true } },
        },
      }),
      prisma.$queryRaw<Array<{ user_id: string; name: string | null; image: string | null; minutes: bigint }>>`
        SELECT u.id AS user_id, u.name, u.image, SUM(te.minutes) AS minutes
        FROM time_entries te
        JOIN users u ON u.id = te."userId"
        WHERE te."workspaceId" = ${workspaceId}::uuid AND te."startedAt" >= ${from}::timestamptz
        GROUP BY u.id, u.name, u.image
      `,
    ]);

    // Map task completions (a task may be assigned to several members).
    const completionCount = new Map<string, number>();
    const completionDays = new Map<string, Set<string>>();
    for (const task of completions) {
      const day = task.completedAt ? task.completedAt.toISOString().slice(0, 10) : "";
      for (const a of task.assignees) {
        completionCount.set(a.userId, (completionCount.get(a.userId) ?? 0) + 1);
        const days = completionDays.get(a.userId) ?? new Set<string>();
        days.add(day);
        completionDays.set(a.userId, days);
      }
    }

    return [
      ...time.map((r) => ({
        user: { id: r.user_id, name: r.name, image: r.image },
        minutes: Number(r.minutes),
        tasksDone: completionCount.get(r.user_id) ?? 0,
        activeDays: completionDays.get(r.user_id)?.size ?? 0,
      })),
      ...[...completionDays.entries()]
        .filter(([id]) => !time.some((t) => t.user_id === id))
        .map(([id, days]) => ({
          user: { id, name: null, image: null },
          minutes: 0,
          tasksDone: completionCount.get(id) ?? 0,
          activeDays: days.size,
        })),
    ];
  }

  /** Count of tasks created/completed per day (for stacked trend chart). */
  async dailyTrend(workspaceId: string, userId: string, days = 14) {
    await this.assertMember(workspaceId, userId);
    const today = startOfDay(new Date());
    const from = subDays(today, days - 1);
    const range = eachDayOfInterval({ start: from, end: today });
    const labels = range.map((d) => format(d, "MMM d"));

    const [created, completed] = await Promise.all([
      prisma.task.findMany({
        where: { workspaceId, createdAt: { gte: from }, isArchived: false },
        select: { createdAt: true },
      }),
      prisma.task.findMany({
        where: { workspaceId, completedAt: { gte: from }, isArchived: false },
        select: { completedAt: true },
      }),
    ]);

    const toKey = (d: Date) => format(new Date(d), "MMM d");
    const idx = new Map(labels.map((l, i) => [l, i]));
    const createdArr = Array(days).fill(0);
    const completedArr = Array(days).fill(0);
    for (const t of created) {
      const i = idx.get(toKey(t.createdAt));
      if (i !== undefined) createdArr[i]++;
    }
    for (const t of completed) {
      if (!t.completedAt) continue;
      const i = idx.get(toKey(t.completedAt));
      if (i !== undefined) completedArr[i]++;
    }

    return labels.map((label, i) => ({
      label,
      created: createdArr[i],
      completed: completedArr[i],
    }));
  }
}

export const analyticsService = new AnalyticsService();