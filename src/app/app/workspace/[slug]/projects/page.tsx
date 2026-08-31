import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { ProjectsClient } from "@/components/projects/projects-client";

type Params = { slug: string };

export default async function ProjectsPage({ params }: { params: Promise<Params> }) {
  const session = await requireSession();
  const { slug } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspace: { slug }, userId: session.user.id, status: "ACTIVE" },
    select: { workspaceId: true, role: true },
  });
  if (!membership) notFound();

  const projects = await prisma.project.findMany({
    where: { workspaceId: membership.workspaceId, isArchived: false },
    include: {
      _count: { select: { tasks: true } },
      statusColumns: { where: { isArchived: false }, orderBy: { position: "asc" }, select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  return (
    <ProjectsClient
      workspaceId={membership.workspaceId}
      slug={slug}
      role={membership.role}
      initialProjects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        key: p.key,
        color: p.color,
        description: p.description,
        taskCount: p._count.tasks,
        columns: p.statusColumns.map((c) => ({ id: c.id, name: c.name })),
        createdAt: p.createdAt,
      }))}
    />
  );
}