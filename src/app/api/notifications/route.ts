import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notificationsQuerySchema } from "@/lib/validators/query";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications?workspaceId=<uuid>[&cursor=<id>][&limit=20]
 * Cursor-paginated notification feed for the signed-in user.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = notificationsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const { cursor, limit } = parsed.data;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { workspaceId, recipientId: session.user.id },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
        taskId: true,
        actor: { select: { id: true, name: true, image: true } },
      },
    }),
    prisma.notification.count({
      where: { workspaceId, recipientId: session.user.id, isRead: false },
    }),
  ]);

  const hasMore = notifications.length > limit;
  const page = hasMore ? notifications.slice(0, limit) : notifications;

  return NextResponse.json({
    notifications: page,
    unread,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}