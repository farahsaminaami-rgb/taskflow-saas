import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-gate";
import { prisma } from "@/lib/db";
import { getSubscriptionAction } from "@/actions/billing.actions";
import { BillingClient } from "@/components/billing/billing-client";

type Params = { slug: string };

export default async function BillingPage({ params }: { params: Promise<Params> }) {
  const session = await requireSession();
  const { slug } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspace: { slug }, userId: session.user.id, status: "ACTIVE" },
    select: { workspaceId: true, role: true },
  });
  if (!membership) notFound();

  const subscription = await getSubscriptionAction(membership.workspaceId);

  return (
    <BillingClient
      workspaceId={membership.workspaceId}
      role={membership.role}
      plan={(subscription?.plan as string) ?? "FREE"}
      status={(subscription?.status as string) ?? null}
      subscription={subscription}
    />
  );
}