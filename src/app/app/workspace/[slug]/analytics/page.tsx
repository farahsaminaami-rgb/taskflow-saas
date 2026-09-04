import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { getWorkspaceAnalyticsAction } from "@/actions/project.actions";
import { invoiceService } from "@/services/invoice.service";
import { OverviewDashboard } from "@/components/analytics/overview-dashboard";
import { AnalyticsDetail } from "@/components/analytics/analytics-detail";

type Params = { slug: string };

export default async function AnalyticsPage({ params }: { params: Promise<Params> }) {
  const session = await requireSession();
  const { slug } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspace: { slug }, userId: session.user.id, status: "ACTIVE" },
    select: { workspaceId: true, role: true },
  });
  if (!membership) notFound();

  const ws = membership.workspaceId;

  const [analytics, projects, clientCount, summary, activity] = await Promise.all([
    getWorkspaceAnalyticsAction(ws),
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
    <>
      <OverviewDashboard
        overview={analytics.overview}
        burndown={analytics.burndown}
        trend={analytics.trend}
        projects={projects}
        role={membership.role}
        clientCount={clientCount}
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
      <AnalyticsDetail productivity={analytics.productivity} />
    </>
  );
}