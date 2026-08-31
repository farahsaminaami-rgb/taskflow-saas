import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth-gate";
import { authService } from "@/services/auth.service";
import { AppShell } from "@/components/shell/app-shell";
import { CreateWorkspaceFlow } from "@/components/workspace/create-workspace-flow";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const memberships = await authService.listMemberships(session.user.id);

  if (memberships.length === 0) {
    // First-run experience: prompt the user to create their first workspace.
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <CreateWorkspaceFlow />
      </div>
    );
  }

  const cookieStore = await cookies();
  const stored = cookieStore.get("active-workspace")?.value ?? null;
  const active = memberships.find((m) => m.workspace.id === stored) ?? memberships[0];

  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    logoUrl: m.workspace.logoUrl,
    plan: m.workspace.plan,
    role: m.role,
  }));

  return (
    <AppShell
      workspaces={workspaces}
      activeWorkspaceId={active.workspace.id}
      activeSlug={active.workspace.slug}
    >
      {children}
    </AppShell>
  );
}