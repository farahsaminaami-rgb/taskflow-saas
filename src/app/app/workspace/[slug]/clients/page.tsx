import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { ClientsClient } from "@/components/clients/clients-client";

type Params = { slug: string };

export const dynamic = "force-dynamic";

export default async function ClientsPage({ params }: { params: Promise<Params> }) {
  const session = await requireSession();
  const { slug } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspace: { slug }, userId: session.user.id, status: "ACTIVE" },
    select: { workspaceId: true, role: true },
  });
  if (!membership) notFound();

  const clients = await prisma.client.findMany({
    where: { workspaceId: membership.workspaceId, status: { not: "ARCHIVED" } },
    include: { _count: { select: { projects: true, invoices: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ClientsClient
      workspaceId={membership.workspaceId}
      slug={slug}
      role={membership.role}
      initialClients={clients.map((c) => ({
        id: c.id,
        companyName: c.companyName,
        contactName: c.contactName,
        email: c.email,
        phone: c.phone,
        website: c.website,
        status: c.status,
        notes: c.notes,
        projectCount: c._count.projects,
        invoiceCount: c._count.invoices,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
