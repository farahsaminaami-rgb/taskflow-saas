"use server";

import { requireSession } from "@/lib/auth-gate";
import { billingService } from "@/services/billing.service";
import { SubscriptionPlan, BillingInterval } from "@prisma/client";
import { ActionResult, fail, ok } from "@/lib/validators";

export async function createCheckoutAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await requireSession();
    const plan = SubscriptionPlan[(input as { plan?: string })?.plan as SubscriptionPlan] as SubscriptionPlan | undefined;
    if (!plan || !["PRO", "BUSINESS"].includes(plan)) return fail("Invalid plan.");
    const interval = BillingInterval[(input as { interval?: string })?.interval as BillingInterval] ?? "MONTHLY";
    const { url } = await billingService.createCheckout(workspaceId, session.user.id, plan, interval);
    return ok({ url });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to start checkout.");
  }
}

export async function createPortalAction(workspaceId: string): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await requireSession();
    const { url } = await billingService.createPortal(workspaceId, session.user.id);
    return ok({ url });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to open billing.");
  }
}

export async function downgradeAction(workspaceId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await billingService.cancelForLocal(workspaceId, session.user.id);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to downgrade.");
  }
}

export async function getSubscriptionAction(workspaceId: string) {
  const session = await requireSession();
  return billingService.getForWorkspace(workspaceId, session.user.id);
}