import { headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { UserRole, MembershipStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Server-side authorization helpers.
 *
 * `cache()` wraps the session read so a single RSC render shares one session
 * resolution instead of re-reading the JWT cookie on every call.
 */

export const getSession = cache(async () => {
  return auth();
});

/** Returns the session or redirects to /login when anonymous. */
export const requireSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
});

export type Membership = {
  userId: string;
  workspaceId: string;
  role: UserRole;
  status: MembershipStatus;
  workspace: { id: string; name: string; slug: string; plan: import("@prisma/client").SubscriptionPlan };
};

function RoleWeight(role: UserRole): number {
  const w: Record<UserRole, number> = {
    VIEWER: 0,
    MEMBER: 10,
    ADMIN: 20,
    OWNER: 30,
  };
  return w[role];
}

export const canAfter = (current: UserRole, required: UserRole): boolean =>
  RoleWeight(current) >= RoleWeight(required);

export class AuthError extends Error {
  constructor(message: string, readonly status = 403) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Resolve the caller's membership in a workspace OR throw. Every tenant-scoped
 * service function starts from this guard — MDV of the isolation boundary.
 */
export const requireMembership = cache(
  async (workspaceId: string, roleAtLeast: UserRole = UserRole.VIEWER) => {
    const session = await auth();
    if (!session?.user?.id) throw new AuthError("You must be signed in", 401);

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: session.user.id },
      },
      select: {
        userId: true,
        workspaceId: true,
        role: true,
        status: true,
        workspace: {
          select: { id: true, name: true, slug: true, plan: true },
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      throw new AuthError("You are not a member of this workspace", 403);
    }
    if (!canAfter(membership.role, roleAtLeast)) {
      throw new AuthError("You do not have permission to perform this action", 403);
    }

    return membership as Membership;
  }
);

/** Convenience: permission gate for non-critical reads. */
export const canRead = (membership?: Membership | null) =>
  !!membership && canAfter(membership.role, UserRole.VIEWER);
export const canEdit = (membership?: Membership | null) =>
  !!membership && canAfter(membership.role, UserRole.MEMBER);
export const canManage = (membership?: Membership | null) =>
  !!membership && canAfter(membership.role, UserRole.ADMIN);
export const canOwnerOnly = (membership?: Membership | null) =>
  !!membership && membership.role === UserRole.OWNER;

/** Current request headers may carry the user's active workspace cookie. */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const match = cookie.match(/active-workspace=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}