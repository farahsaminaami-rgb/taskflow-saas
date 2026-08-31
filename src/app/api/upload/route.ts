import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlan } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/json",
  "application/zip",
]);

/**
 * Multipart attachment upload. Files land on the local filesystem under
 * `./uploads/{workspaceId}/{taskId}/`. Swap for a signed S3/R2 presigned URL
 * flow in production — the contract (Record row + url) stays identical.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const taskId = formData.get("taskId")?.toString();
  const file = formData.get("file");

  if (!taskId || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing taskId or file" }, { status: 400 });
  }
  if (!file.size || file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: task.workspaceId, userId: session.user.id } },
  });
  if (!membership || membership.status !== "ACTIVE") {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: task.workspaceId } });
  const plan = getPlan(ws.plan);

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 415 });
  }
  const mb = file.size / (1024 * 1024);
  if (mb > plan.maxAttachmentSizeMb) {
    return NextResponse.json({ error: `Max ${plan.maxAttachmentSizeMb}MB per file on the ${plan.name} plan` }, { status: 413 });
  }

  const existing = await prisma.attachment.count({ where: { taskId, workspaceId: task.workspaceId } });
  if (existing >= plan.maxAttachmentsPerTask) {
    return NextResponse.json({ error: "Attachment limit reached for this task" }, { status: 413 });
  }

  const ext = path.extname(file.name).slice(0, 16);
  const safeName = file.name.replace(/[^\w.\- ]/g, "").slice(0, 160);
  const key = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "uploads", task.workspaceId, task.id);
  const absPath = path.join(dir, key);

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(absPath, Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    console.error("[upload] write failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const record = await prisma.attachment.create({
    data: {
      workspaceId: task.workspaceId,
      taskId,
      uploadedById: session.user.id,
      name: safeName,
      mimeType: file.type,
      size: file.size,
      url: `/uploads/${task.workspaceId}/${task.id}/${key}`,
    },
  });

  return NextResponse.json({ attachment: record });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}