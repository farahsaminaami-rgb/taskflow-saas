import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { getWorkspaceAnalyticsAction } from "@/actions/project.actions";
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

  const [analytics, projects] = await Promise.all([
    getWorkspaceAnalyticsAction(membership.workspaceId),
    prisma.project.findMany({
      where: { workspaceId: membership.workspaceId, isArchived: false },
      select: { id: true, name: true, key: true, color: true },
      orderBy: { createdAt: "desc" },
      take: 6,
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
      />
      <AnalyticsDetail productivity={analytics.productivity} />
    </>
  );
}