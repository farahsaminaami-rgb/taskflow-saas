import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { authService } from "@/services/auth.service";

export const dynamic = "force-dynamic";

/**
 * `/app` landing page. Users with workspaces are sent to their most recent
 * active workspace dashboard; users with none hit the first-run onboarding
 * rendered by `app/layout.tsx`.
 */
export default async function AppHomePage() {
  const session = await requireSession();
  const memberships = await authService.listMemberships(session.user.id);

  if (memberships.length === 0) {
    return null;
  }

  redirect(`/app/workspace/${memberships[0].workspace.slug}`);
}