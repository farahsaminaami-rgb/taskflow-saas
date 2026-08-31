import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { WorkspaceRealtimeManager } from "@/components/workspace/workspace-realtime-manager";
import { WorkspaceHeaderTabs } from "@/components/workspace/workspace-header-tabs";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const { slug } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspace: { slug },
      userId: session.user.id,
      status: "ACTIVE",
    },
    select: {
      role: true,
      status: true,
      workspace: {
        select: {
          id: true,
          slug: true,
          name: true,
          plan: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!membership) notFound();

  return (
    <WorkspaceProvider
      value={{
        workspaceId: membership.workspace.id,
        slug: membership.workspace.slug,
        name: membership.workspace.name,
        role: membership.role,
        plan: membership.workspace.plan,
      }}
    >
      <WorkspaceRealtimeManager />
      <div className="min-h-screen">
        <WorkspaceHeaderTabs
          workspaceId={membership.workspace.id}
          slug={membership.workspace.slug}
          name={membership.workspace.name}
          plan={membership.workspace.plan}
        />
        {children}
      </div>
    </WorkspaceProvider>
  );
}