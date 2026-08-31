import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { SettingsClient } from "@/components/settings/settings-client";

type Params = { slug: string };

export default async function SettingsPage({ params }: { params: Promise<Params> }) {
  const session = await requireSession();
  const { slug } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspace: { slug }, userId: session.user.id, status: "ACTIVE" },
    select: {
      workspaceId: true,
      role: true,
      workspace: { select: { id: true, name: true, slug: true, description: true, logoUrl: true, plan: true, createdAt: true } },
    },
  });
  if (!membership) notFound();

  return (
    <SettingsClient
      workspaceId={membership.workspaceId}
      role={membership.role}
      workspace={membership.workspace}
    />
  );
}