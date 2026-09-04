import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import type { CreateInvoiceInput, UpdateInvoiceInput, InvoiceItemInput } from "@/lib/validators/crm";
import { InvoiceStatus, type UserRole, type NotificationType } from "@prisma/client";
import { workspaceService } from "./workspace.service";
import { dispatchEvent } from "@/lib/realtime/dispatch";
import { notificationService } from "./notification.service";

function computeTotals(
  items: InvoiceItemInput[],
  taxRate: number,
  discount: number
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = Math.max(0, subtotal - discount + taxAmount);
  return { subtotal: round2(subtotal), taxAmount: round2(taxAmount), total: round2(total) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class InvoiceService {
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

  private async assertClientInWorkspace(workspaceId: string, clientId: string) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, workspaceId },
      select: { id: true },
    });
    if (!client) throw new AuthError("Client not found in this workspace.", 404);
  }

  private async assertProjectScoped(workspaceId: string, projectId: string | null) {
    if (!projectId) return;
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    });
    if (!project) throw new AuthError("Project not found.", 404);
  }

  /** Generate the next sequential invoice number for a workspace. */
  private async nextNumber(workspaceId: string): Promise<string> {
    const last = await prisma.invoice.findFirst({
      where: { workspaceId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const nextNum = last ? parseInt((last.number.match(/(\d+)$/) ?? ["0", "0"])[1], 10) + 1 : 1001;
    return `INV-${nextNum}`;
  }

  private async getScoped(workspaceId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, workspaceId },
    });
    if (!invoice) throw new AuthError("Invoice not found.", 404);
    return invoice;
  }

  async create(workspaceId: string, userId: string, input: CreateInvoiceInput) {
    await this.assertRole(workspaceId, userId);
    await this.assertClientInWorkspace(workspaceId, input.clientId);
    await this.assertProjectScoped(workspaceId, input.projectId ?? null);

    const { subtotal, taxAmount, total } = computeTotals(input.items, input.taxRate, input.discount ?? 0);
    const number = await this.nextNumber(workspaceId);

    const invoice = await prisma.invoice.create({
      data: {
        workspaceId,
        clientId: input.clientId,
        projectId: input.projectId ?? null,
        createdById: userId,
        number,
        status: input.status ?? InvoiceStatus.DRAFT,
        currency: input.currency,
        issueDate: input.issueDate,
        dueDate: input.dueDate ?? null,
        taxRate: input.taxRate ?? 0,
        discount: input.discount ?? 0,
        subtotal,
        taxAmount,
        total,
        notes: input.notes || null,
        items: {
          create: input.items.map((i) => ({
            workspaceId,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            amount: round2(i.quantity * i.unitPrice),
          })),
        },
      },
      include: { items: true, client: { select: { id: true, companyName: true } } },
    });

    await workspaceService.logActivity(workspaceId, userId, "invoice.created", "invoice", invoice.id, {
      number: invoice.number,
      total: invoice.total,
    });
    await dispatchEvent({
      type: "invoice.updated",
      workspaceId,
      actorId: userId,
      data: { invoice: { id: invoice.id, number: invoice.number, status: invoice.status, total: invoice.total } },
    });
    return invoice;
  }

  async update(workspaceId: string, userId: string, invoiceId: string, input: UpdateInvoiceInput) {
    await this.assertRole(workspaceId, userId);
    const existing = await this.getScoped(workspaceId, invoiceId);
    if (existing.status === InvoiceStatus.PAID) {
      throw new AuthError("Paid invoices cannot be edited.", 400);
    }
    if (input.clientId) await this.assertClientInWorkspace(workspaceId, input.clientId);
    await this.assertProjectScoped(workspaceId, input.projectId || existing.projectId);

    const items = input.items ?? [];
    const taxRate = input.taxRate ?? existing.taxRate;
    const discount = input.discount ?? existing.discount;
    const totals = items.length ? computeTotals(items, taxRate, discount) : null;

    const data: Record<string, unknown> = {};
    if (input.clientId) data.clientId = input.clientId;
    if (input.projectId !== undefined) data.projectId = input.projectId || null;
    if (input.status) data.status = input.status;
    if (input.currency) data.currency = input.currency;
    if (input.issueDate) data.issueDate = input.issueDate;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate || null;
    if (input.taxRate !== undefined) data.taxRate = input.taxRate;
    if (input.discount !== undefined) data.discount = input.discount;
    if (input.notes !== undefined) data.notes = input.notes || null;
    if (totals) {
      data.subtotal = totals.subtotal;
      data.taxAmount = totals.taxAmount;
      data.total = totals.total;
    }

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: invoiceId }, data });
      if (items.length) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId, workspaceId } });
        await tx.invoiceItem.createMany({
          data: items.map((i) => ({
            workspaceId,
            invoiceId,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            amount: round2(i.quantity * i.unitPrice),
          })),
        });
      }
      return tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: { items: true, client: { select: { id: true, companyName: true } } },
      });
    });

    await workspaceService.logActivity(workspaceId, userId, "invoice.updated", "invoice", invoiceId, {
      number: invoice.number,
    });
    await dispatchEvent({
      type: "invoice.updated",
      workspaceId,
      actorId: userId,
      data: { invoice: { id: invoice.id, number: invoice.number, status: invoice.status, total: invoice.total } },
    });
    return invoice;
  }

  async send(workspaceId: string, userId: string, invoiceId: string) {
    await this.assertRole(workspaceId, userId, ["ADMIN", "OWNER"]);
    const invoice = await this.getScoped(workspaceId, invoiceId);
    if (invoice.status === InvoiceStatus.CANCELLED) throw new AuthError("Cancelled invoices cannot be sent.", 400);
    const sent = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: invoice.status === InvoiceStatus.PAID ? InvoiceStatus.PAID : InvoiceStatus.SENT },
    });

    await this.afterStateChange(workspaceId, userId, sent, "invoice.sent");
    return sent;
  }

  async markPaid(workspaceId: string, userId: string, invoiceId: string, paid: boolean) {
    await this.assertRole(workspaceId, userId, ["ADMIN", "OWNER"]);
    await this.getScoped(workspaceId, invoiceId);
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: paid ? InvoiceStatus.PAID : InvoiceStatus.SENT, paidAt: paid ? new Date() : null },
    });
    await this.afterStateChange(workspaceId, userId, updated, paid ? "invoice.paid" : "invoice.sent");
    return updated;
  }

  async cancel(workspaceId: string, userId: string, invoiceId: string) {
    await this.assertRole(workspaceId, userId, ["ADMIN", "OWNER"]);
    const invoice = await this.getScoped(workspaceId, invoiceId);
    if (invoice.status === InvoiceStatus.PAID) throw new AuthError("Paid invoices cannot be cancelled.", 400);
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.CANCELLED },
    });
    await this.afterStateChange(workspaceId, userId, updated, "invoice.cancelled");
    return updated;
  }

  private async afterStateChange(
    workspaceId: string,
    userId: string,
    invoice: { id: string; number: string; status: InvoiceStatus; total: number; clientId: string },
    action: string
  ) {
    await workspaceService.logActivity(workspaceId, userId, action, "invoice", invoice.id, {
      number: invoice.number,
      status: invoice.status,
    });
    await dispatchEvent({
      type: "invoice.updated",
      workspaceId,
      actorId: userId,
      data: { invoice: { id: invoice.id, number: invoice.number, status: invoice.status, total: invoice.total } },
    });
    const client = await prisma.client.findFirst({ where: { id: invoice.clientId, workspaceId }, select: { companyName: true } });
    const notifyType: NotificationType = action === "invoice.paid" ? "INVOICE_PAID" : "INVOICE_STATUS_CHANGED";
    await notificationService.createMany(
      [
        {
          workspaceId,
          recipientId: (await this.scopedOwnersForNotify(workspaceId)).filter((id) => id !== userId)[0] ?? userId,
          actorId: userId,
          type: notifyType,
          title: `${invoice.number} ${action === "invoice.paid" ? "was marked paid" : action === "invoice.cancelled" ? "was cancelled" : "was sent"}`,
          message: client ? `${client.companyName} · ${invoice.status}` : undefined,
          data: { invoiceId: invoice.id, number: invoice.number },
        },
      ].filter(Boolean)
    );
  }

  private async scopedOwnersForNotify(workspaceId: string): Promise<string[]> {
    const rows = await prisma.workspaceMember.findMany({
      where: { workspaceId, status: "ACTIVE", role: { in: ["ADMIN", "OWNER"] } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async list(workspaceId: string, userId: string) {
    await this.assertRole(workspaceId, userId);
    const invoices = await prisma.invoice.findMany({
      where: { workspaceId },
      include: {
        client: { select: { id: true, companyName: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });
    return invoices;
  }

  async get(workspaceId: string, userId: string, invoiceId: string) {
    await this.assertRole(workspaceId, userId);
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, workspaceId },
      include: {
        client: true,
        project: { select: { id: true, name: true, key: true } },
        items: true,
        createdBy: { select: { id: true, name: true, image: true } },
        workspace: { select: { id: true, name: true, slug: true, logoUrl: true } },
      },
    });
    if (!invoice) throw new AuthError("Invoice not found.", 404);
    return invoice;
  }

  /** Outstanding balance, counts, and per-status totals for dashboards. */
  async summary(workspaceId: string, userId: string) {
    await this.assertRole(workspaceId, userId, ["VIEWER", "MEMBER", "ADMIN", "OWNER"]);
    const rows = await prisma.invoice.findMany({
      where: { workspaceId },
      select: { status: true, total: true },
    });
    let outstanding = 0;
    let paid = 0;
    let overdue = 0;
    for (const r of rows) {
      if (r.status === InvoiceStatus.PAID) paid += r.total;
      else if (r.status === InvoiceStatus.OVERDUE) {
        outstanding += r.total;
        overdue += r.total;
      } else if (r.status === InvoiceStatus.SENT || r.status === InvoiceStatus.PENDING) outstanding += r.total;
    }
    return {
      outstanding: round2(outstanding),
      paid: round2(paid),
      overdue: round2(overdue),
      count: rows.length,
    };
  }
}

export const invoiceService = new InvoiceService();
