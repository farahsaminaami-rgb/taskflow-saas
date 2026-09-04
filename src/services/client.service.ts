import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import type { CreateClientInput, UpdateClientInput } from "@/lib/validators/crm";
import { workspaceService } from "./workspace.service";
import { dispatchEvent } from "@/lib/realtime/dispatch";
import { notificationService } from "./notification.service";
import type { UserRole } from "@prisma/client";

export class ClientService {
  private async assertRole(
    workspaceId: string,
    userId: string,
    roles: UserRole[] = ["ADMIN", "OWNER", "MEMBER"]
  ) {
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m || m.status !== "ACTIVE") {
      throw new AuthError("You are not a member of this workspace.", 403);
    }
    if (!roles.includes(m.role)) throw new AuthError("You do not have permission to do that.", 403);
    return m;
  }

  async create(workspaceId: string, userId: string, input: CreateClientInput) {
    await this.assertRole(workspaceId, userId);

    const client = await prisma.client.create({
      data: {
        workspaceId,
        createdById: userId,
        companyName: input.companyName,
        contactName: input.contactName || null,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        status: input.status,
        notes: input.notes || null,
      },
    });

    await workspaceService.logActivity(workspaceId, userId, "client.created", "client", client.id, {
      name: client.companyName,
      status: client.status,
    });
    await dispatchEvent({
      type: "client.updated",
      workspaceId,
      actorId: userId,
      data: { client: { id: client.id, companyName: client.companyName, status: client.status } },
    });

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId, status: "ACTIVE", role: { in: ["ADMIN", "OWNER"] } },
      select: { userId: true },
    });
    await notificationService.createMany(
      members.map((m) => ({
        workspaceId,
        recipientId: m.userId,
        actorId: userId,
        type: "CLIENT_CREATED",
        title: `New client: ${client.companyName}`,
        message: "A new client was added to your pipeline.",
        data: { clientId: client.id },
      }))
    );

    return client;
  }

  async list(workspaceId: string, userId: string) {
    await this.assertRole(workspaceId, userId);
    const clients = await prisma.client.findMany({
      where: { workspaceId, status: { not: "ARCHIVED" } },
      include: {
        _count: { select: { projects: true, invoices: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });
    return clients;
  }

  async get(workspaceId: string, userId: string, clientId: string) {
    await this.assertRole(workspaceId, userId);
    const client = await prisma.client.findFirst({
      where: { id: clientId, workspaceId },
      include: {
        projects: {
          where: { isArchived: false },
          select: { id: true, name: true, key: true, color: true },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            currency: true,
            issueDate: true,
            dueDate: true,
          },
        },
        _count: { select: { projects: true, invoices: true } },
      },
    });
    if (!client) throw new AuthError("Client not found.", 404);
    return client;
  }

  async update(workspaceId: string, userId: string, clientId: string, input: UpdateClientInput) {
    await this.assertRole(workspaceId, userId);
    await this.assertExists(workspaceId, clientId);

    const data: Record<string, unknown> = {};
    if (input.companyName) data.companyName = input.companyName;
    if (input.contactName !== undefined) data.contactName = input.contactName || null;
    if (input.email !== undefined) data.email = input.email || null;
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.website !== undefined) data.website = input.website || null;
    if (input.status) data.status = input.status;
    if (input.notes !== undefined) data.notes = input.notes || null;

    const client = await prisma.client.update({ where: { id: clientId }, data });

    await workspaceService.logActivity(workspaceId, userId, "client.updated", "client", clientId, {
      name: client.companyName,
    });
    await dispatchEvent({
      type: "client.updated",
      workspaceId,
      actorId: userId,
      data: { client: { id: client.id, companyName: client.companyName, status: client.status } },
    });
    return client;
  }

  async archive(workspaceId: string, userId: string, clientId: string, archived: boolean) {
    await this.assertRole(workspaceId, userId, ["ADMIN", "OWNER"]);
    await this.assertExists(workspaceId, clientId);
    const client = await prisma.client.update({
      where: { id: clientId },
      data: { status: archived ? "ARCHIVED" : "ACTIVE" },
    });
    await workspaceService.logActivity(workspaceId, userId, "client.archived", "client", clientId, {
      name: client.companyName,
    });
    return client;
  }

  private async assertExists(workspaceId: string, clientId: string) {
    const found = await prisma.client.findFirst({ where: { id: clientId, workspaceId }, select: { id: true } });
    if (!found) throw new AuthError("Client not found.", 404);
  }
}

export const clientService = new ClientService();
