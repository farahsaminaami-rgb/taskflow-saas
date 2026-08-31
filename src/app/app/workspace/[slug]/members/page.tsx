import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { MembersClient } from "@/components/members/members-client";

type Params = { slug: string };

export default async function MembersPage({ params }: { params: Promise<Params> }) {
  const session = await requireSession();
  const { slug } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspace: { slug }, userId: session.user.id, status: "ACTIVE" },
    select: { workspaceId: true, role: true },
  });
  if (!membership) notFound();

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: membership.workspaceId, status: "ACTIVE" },
    select: {
      id: true,
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });

  return (
    <MembersClient
      workspaceId={membership.workspaceId}
      role={membership.role}
      currentUserId={session.user.id}
      initialMembers={members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      }))}
    />
  );
}