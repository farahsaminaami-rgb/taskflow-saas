import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { invoiceService } from "@/services/invoice.service";
import { InvoicesClient } from "@/components/invoices/invoices-client";

type Params = { slug: string };

export const dynamic = "force-dynamic";

export default async function InvoicesPage({ params }: { params: Promise<Params> }) {
  const session = await requireSession();
  const { slug } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspace: { slug }, userId: session.user.id, status: "ACTIVE" },
    select: { workspaceId: true, role: true },
  });
  if (!membership) notFound();

  const [invoices, clients, projects, summary] = await Promise.all([
    prisma.invoice.findMany({
      where: { workspaceId: membership.workspaceId },
      include: { client: { select: { id: true, companyName: true } }, items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { workspaceId: membership.workspaceId, status: { not: "ARCHIVED" } },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    prisma.project.findMany({
      where: { workspaceId: membership.workspaceId, isArchived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    invoiceService.summary(membership.workspaceId, session.user.id),
  ]);

  return (
    <InvoicesClient
      workspaceId={membership.workspaceId}
      slug={slug}
      role={membership.role}
      initialInvoices={invoices.map((i) => ({
        id: i.id,
        number: i.number,
        clientId: i.clientId,
        clientName: i.client.companyName,
        projectId: i.projectId,
        status: i.status,
        currency: i.currency,
        issueDate: i.issueDate.toISOString(),
        dueDate: i.dueDate ? i.dueDate.toISOString() : null,
        subtotal: i.subtotal,
        taxRate: i.taxRate,
        taxAmount: i.taxAmount,
        discount: i.discount,
        total: i.total,
        notes: i.notes,
        items: i.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          amount: it.amount,
        })),
      }))}
      clients={clients}
      projects={projects}
      summary={{ outstanding: summary.outstanding, paid: summary.paid, overdue: summary.overdue, count: summary.count }}
    />
  );
}
