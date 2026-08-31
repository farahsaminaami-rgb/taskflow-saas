import Stripe from "stripe";
import {
  SubscriptionPlan,
  SubscriptionStatus,
  BillingInterval,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import { env, isDev } from "@/lib/env";
import { PLANS, type PlanDefinition } from "@/lib/plans";

/**
 * Billing service — Stripe integration with a development-safe fallback.
 *
 * When STRIPE_SECRET_KEY is absent (local dev) checkout/portal calls return a
 * graceful "mock" upgrade path so the whole flow can still be exercised end to
 * end against the DB.
 */

function stripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
}

export class BillingService {
  async getForWorkspace(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    return prisma.subscription.findUnique({
      where: { workspaceId },
      include: { workspace: { select: { id: true, name: true } } },
    });
  }

  async createCheckout(workspaceId: string, userId: string, plan: SubscriptionPlan, interval: BillingInterval) {
    const membership = await this.assertMember(workspaceId, userId);
    if (membership.role !== "OWNER") throw new AuthError("Only the workspace owner can manage billing.", 403);

    const def: PlanDefinition = PLANS[plan];
    if (!def) throw new AuthError("Unknown plan.", 400);
    if (def.priceMonthlyCents === null) throw new AuthError("Enterprise plans require a sales contact.", 400);

    const priceId = interval === "MONTHLY" ? def.stripePriceMonthlyId : def.stripePriceYearlyId;
    const client = stripe();

    // --- Mock path (no Stripe configured) -------------------------------
    if (!client) {
      if (!isDev) throw new AuthError("Billing is not configured on this instance.", 500);
      await prisma.$transaction([
        prisma.subscription.upsert({
          where: { workspaceId },
          create: {
            workspaceId,
            plan,
            status: "ACTIVE",
            interval,
            seats: await prisma.workspaceMember.count({ where: { workspaceId, status: "ACTIVE" } }),
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + (interval === "MONTHLY" ? 30 : 365) * 86_400_000),
          },
          update: { plan, interval, status: "ACTIVE" },
        }),
        prisma.workspace.update({ where: { id: workspaceId }, data: { plan } }),
      ]);
      return { url: `${env.NEXT_PUBLIC_APP_URL}/app/billing?mock=upgraded&plan=${plan}` };
    }

    // --- Real Stripe path ------------------------------------------------
    if (!priceId) throw new AuthError("No Stripe price is mapped for this plan yet.", 500);

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });

    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      const customer = await client.customers.create({
        email: (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).email ?? undefined,
        name: workspace.name,
        metadata: { workspaceId },
      });
      customerId = customer.id;
      await prisma.workspace.update({ where: { id: workspaceId }, data: { stripeCustomerId: customerId } });
    }

    const session = await client.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.NEXT_PUBLIC_APP_URL}/app/billing?checkout=success`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/app/billing?checkout=cancelled`,
      metadata: { workspaceId, plan, interval },
      subscription_data: {
        metadata: { workspaceId, plan },
      },
    });

    return { url: session.url! };
  }

  async createPortal(workspaceId: string, userId: string) {
    const membership = await this.assertMember(workspaceId, userId);
    if (membership.role !== "OWNER") throw new AuthError("Only the workspace owner can manage billing.", 403);

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const client = stripe();

    if (!client || !workspace.stripeCustomerId) {
      // Reasonable mock when billing is not configured.
      return { url: `${env.NEXT_PUBLIC_APP_URL}/app/billing` };
    }

    const session = await client.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/app/billing`,
    });
    return { url: session.url };
  }

  async cancelForLocal(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
    if (!sub || sub.plan === "FREE") return sub;

    const latest = await prisma.workspaceMember.count({ where: { workspaceId, status: "ACTIVE" } });

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { workspaceId },
        data: { plan: "FREE", status: "ACTIVE", cancelAtPeriodEnd: false },
      });
      await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          plan: "FREE",
          maxMembers: PLANS.FREE.maxMembers ?? 5,
          maxProjects: PLANS.FREE.maxProjects ?? 3,
          maxTasksPerProject: PLANS.FREE.maxTasksPerProject ?? 100,
        },
      });
      // Downgrade: keep the most recent `latest` active seats (idempotent cap).
      await tx.$executeRaw`
        UPDATE workspace_members SET status = 'REVOKED', "leftAt" = now()
        WHERE "workspaceId" = ${workspaceId}::uuid AND status = 'ACTIVE'
          AND id NOT IN (
            SELECT id FROM workspace_members
            WHERE "workspaceId" = ${workspaceId}::uuid AND status = 'ACTIVE'
            ORDER BY "joinedAt" ASC
            LIMIT ${latest}
          )
      `;
    });
  }

  // ---------------------------------------------------------------------
  // Stripe webhook processing
  // ---------------------------------------------------------------------

  async handleWebhook(payload: string, signature: string): Promise<{ ok: boolean; type?: string }> {
    const client = stripe();
    if (!client) {
      // Dev fallback: parse and ghost-process known local events.
      return { ok: true, type: "mock" };
    }

    let event: Stripe.Event;
    try {
      event = client.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET!);
    } catch (error) {
      console.error("[billing] webhook signature verification failed", error);
      return { ok: false };
    }

    const workspaceId =
      this.extractWorkspaceId(event) ??
      (
        await this.findByCustomer(event.data.object as { customer?: string | Stripe.Customer | Stripe.DeletedCustomer })
      ).workspaceId;

    await prisma.billingEvent.create({
      data: {
        workspaceId: workspaceId ?? "",
        stripeEventId: event.id,
        type: event.type,
        payload: event.data.object as unknown as object,
      },
    });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const wid = session.metadata?.workspaceId;
        const plan = (session.metadata?.plan as SubscriptionPlan) ?? "PRO";
        if (wid) await this.applyPlan(wid, plan);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await this.syncSubscription(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const wid = (sub.metadata?.workspaceId as string) ?? (await this.findByCustomer(sub)).workspaceId;
        if (wid) await this.applyPlan(wid, "FREE");
        break;
      }
    }

    return { ok: true, type: event.type };
  }

  private async syncSubscription(sub: Stripe.Subscription) {
    const items = sub.items.data;
    if (!items.length) return;
    const price = items[0].price;
    const plan = this.planFromPrice(price.id);
    const wid = (sub.metadata?.workspaceId as string) ?? (await this.findByCustomer(sub)).workspaceId;
    if (!wid) return;

    const statusMap: Record<string, SubscriptionStatus> = {
      trialing: "TRIALING",
      active: "ACTIVE",
      past_due: "PAST_DUE",
      unpaid: "UNPAID",
      canceled: "CANCELED",
    };

    await prisma.subscription.upsert({
      where: { workspaceId: wid },
      create: {
        workspaceId: wid,
        plan,
        status: statusMap[sub.status] ?? "ACTIVE",
        interval: price.recurring?.interval === "year" ? "YEARLY" : "MONTHLY",
        stripeSubscriptionId: sub.id,
        stripeCustomerId: sub.customer as string,
        currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      update: {
        plan,
        status: statusMap[sub.status] ?? "ACTIVE",
        interval: price.recurring?.interval === "year" ? "YEARLY" : "MONTHLY",
        stripeSubscriptionId: sub.id,
        stripeCustomerId: sub.customer as string,
        currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    });

    if (sub.status === "active" || sub.status === "trialing") {
      await this.applyPlan(wid, plan);
    }
  }

  private async applyPlan(workspaceId: string, plan: SubscriptionPlan) {
    const limits = PLANS[plan];
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        plan,
        maxMembers: limits.maxMembers ?? 99999,
        maxProjects: limits.maxProjects ?? 99999,
        maxTasksPerProject: limits.maxTasksPerProject ?? 99999,
      },
    });
  }

  private planFromPrice(priceId: string): SubscriptionPlan {
    const normalized = priceId.toLowerCase();
    if (normalized.includes("business")) return "BUSINESS";
    if (normalized.includes("enterprise")) return "ENTERPRISE";
    if (normalized.includes("pro")) return "PRO";
    return "FREE";
  }

  private extractWorkspaceId(event: Stripe.Event): string | null {
    const obj = event.data.object as unknown as Record<string, unknown>;
    const meta = obj.metadata as Record<string, unknown> | undefined;
    return typeof meta?.workspaceId === "string" ? meta.workspaceId : null;
  }

  private async findByCustomer(obj: { customer?: string | Stripe.Customer | Stripe.DeletedCustomer }): Promise<{ workspaceId: string }> {
    const customerId = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
    const ws = customerId
      ? await prisma.workspace.findUnique({ where: { stripeCustomerId: customerId } })
      : null;
    return { workspaceId: ws?.id ?? "" };
  }

  private async assertMember(workspaceId: string, userId: string) {
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m || m.status !== "ACTIVE") throw new AuthError("You are not a member of this workspace.", 403);
    return m;
  }
}

export const billingService = new BillingService();