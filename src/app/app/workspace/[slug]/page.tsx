import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { analyticsService } from "@/services/analytics.service";
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

  const [overview, burndown, trend, projects] = await Promise.all([
    analyticsService.workspaceOverview(membership.workspaceId, session.user.id),
    analyticsService.burndown(membership.workspaceId, session.user.id, 14),
    analyticsService.dailyTrend(membership.workspaceId, session.user.id, 14),
    prisma.project.findMany({
      where: { workspaceId: membership.workspaceId, isArchived: false },
      select: { id: true, name: true, key: true, color: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  return <OverviewDashboard overview={overview} burndown={burndown} trend={trend} projects={projects} role={membership.role} />;
}