import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { getAIConfig } from "@/services/ai.service";
import { AssistantClient } from "@/components/assistant/assistant-client";

type Params = { slug: string };

export const dynamic = "force-dynamic";

export default async function AssistantPage({ params }: { params: Promise<Params> }) {
  const session = await requireSession();
  const { slug } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspace: { slug }, userId: session.user.id, status: "ACTIVE" },
    select: { workspaceId: true },
  });
  if (!membership) notFound();

  return (
    <AssistantClient
      workspaceId={membership.workspaceId}
      initialConfig={getAIConfig()}
    />
  );
}
