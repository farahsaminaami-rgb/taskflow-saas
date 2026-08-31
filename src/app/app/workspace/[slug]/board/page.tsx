import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { BoardPageClient } from "@/components/board/board-page-client";

type Params = { slug: string };
type SearchParams = { project?: string };

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const { slug } = await params;
  const sp = await searchParams;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspace: { slug }, userId: session.user.id, status: "ACTIVE" },
    select: { workspaceId: true, role: true },
  });
  if (!membership) notFound();

  const projects = await prisma.project.findMany({
    where: { workspaceId: membership.workspaceId, isArchived: false },
    select: { id: true, name: true, key: true, color: true },
    orderBy: { createdAt: "asc" },
  });

  const initialProjectId =
    projects.find((p) => p.id === sp.project)?.id ?? projects[0]?.id ?? null;

  return (
    <BoardPageClient
      workspaceId={membership.workspaceId}
      slug={slug}
      role={membership.role}
      projects={projects}
      initialProjectId={initialProjectId}
    />
  );
}