import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { analyticsService } from "@/services/analytics.service";
import { invoiceService } from "@/services/invoice.service";
import { OverviewDashboard } from "@/components/analytics/overview-dashboard";

type Params = { slug: string };

export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const session = await requireSession();
  const { slug } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspace: { slug }, userId: session.user.id, status: "ACTIVE" },
    select: { workspaceId: true, workspace: { select: { id: true } }, role: true },
  });
  if (!membership) notFound();

  const ws = membership.workspaceId;

  const [overview, burndown, trend, projects, clients, summary, activity] = await Promise.all([
    analyticsService.workspaceOverview(ws, session.user.id),
    analyticsService.burndown(ws, session.user.id, 14),
    analyticsService.dailyTrend(ws, session.user.id, 14),
    prisma.project.findMany({
      where: { workspaceId: ws, isArchived: false },
      select: { id: true, name: true, key: true, color: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.client.count({ where: { workspaceId: ws, status: { not: "ARCHIVED" } } }),
    invoiceService.summary(ws, session.user.id),
    prisma.activityLog.findMany({
      where: { workspaceId: ws },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { id: true, name: true, image: true } } },
    }),
  ]);

  return (
    <OverviewDashboard
      overview={overview}
      burndown={burndown}
      trend={trend}
      projects={projects}
      role={membership.role}
      clientCount={clients}
      summary={summary}
      activity={activity.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        meta: a.meta as Record<string, unknown>,
        createdAt: a.createdAt.toISOString(),
        actor: a.actor ? { id: a.actor.id, name: a.actor.name, image: a.actor.image } : null,
      }))}
    />
  );
}
