import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { workspaceChannel } from "@/lib/realtime/events";
import { subscribe, replay } from "@/lib/realtime/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream for a workspace's boards.
 *
 *   GET /api/realtime/board?workspaceId=<uuid>&lastEventId=<n>
 *
 * Subscribes this connection to the workspace channel, replays anything newer
 * than `lastEventId` from the in-memory ring buffer, then streams new events.
 * A `: ping` comment keeps proxies from killing the idle socket.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const lastEventId = Number(searchParams.get("lastEventId") ?? 0) || 0;

  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  if (!workspaceId) return new Response("Missing workspaceId", { status: 400 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership || membership.status !== "ACTIVE") {
    return new Response("Forbidden", { status: 403 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller was closed — stop writing.
        }
      };

      // Replay missed events so a reconnecting client reaches full state.
      for (const event of replay(workspaceChannel(workspaceId), lastEventId)) {
        send(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
      }
      // Flush immediately (streams can buffer otherwise).
      send(`: connected\n\n`);

      const unsub = subscribe(workspaceChannel(workspaceId), {
        signal: new AbortController().signal,
        send: (event) => {
          send(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
        },
      });

      const heartbeat = setInterval(() => {
        send(`: ping ${Date.now()}\n\n`);
      }, HEARTBEAT_MS);

      // Close cleanly when the client disconnects.
      const abort = request.signal;
      abort.addEventListener(
        "abort",
        () => {
          clearInterval(heartbeat);
          unsub();
          try {
            controller.close();
          } catch {
            // already closed
          }
        },
        { once: true }
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}