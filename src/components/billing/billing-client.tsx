"use client";

import * as React from "react";
import { useState } from "react";
import { Loader2, ArrowRight, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { createCheckoutAction, createPortalAction, downgradeAction } from "@/actions/billing.actions";
import { PLANS } from "@/lib/plans";
import { cn, formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function price(plan: (typeof PLANS)["FREE"], yearly: boolean) {
  const cents = yearly ? plan.priceYearlyCents : plan.priceMonthlyCents;
  if (cents === null) return "Custom";
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function BillingClient({
  workspaceId,
  role,
  plan,
  status,
  subscription,
}: {
  workspaceId: string;
  role: string;
  plan: string;
  status: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscription: any;
}) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const isOwner = role === "OWNER";

  const perks: Record<string, string[]> = {
    FREE: ["5 members", "3 projects", "100 tasks per project", "10MB attachments"],
    PRO: ["Unlimited members", "Unlimited projects", "Unlimited tasks", "Advanced roles"],
    BUSINESS: ["Everything in Pro", "100MB attachments", "Priority support"],
    ENTERPRISE: ["Custom onboarding", "SSO & support SLA", "250MB attachments"],
  };

  async function buy(targetPlan: string) {
    if (targetPlan === plan) return;
    setPendingPlan(targetPlan);
    try {
      const r = await createCheckoutAction(workspaceId, {
        plan: targetPlan,
        interval: billing === "yearly" ? "YEARLY" : "MONTHLY",
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      window.location.href = r.data.url;
    } finally {
      setPendingPlan(null);
    }
  }

  async function openPortal() {
    const r = await createPortalAction(workspaceId);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    window.location.href = r.data.url;
  }

  async function downgrade() {
    const r = await downgradeAction(workspaceId);
    if (r.ok) toast.success("Downgraded to Free");
    else toast.error(r.error);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
          <p className="text-sm text-muted-foreground">Manage your workspace subscription and plan limits.</p>
        </div>
        {isOwner && (status === "ACTIVE" || status === "TRIALING" || plan !== "FREE") && (
          <Button variant="outline" onClick={() => void openPortal()} className="gap-2">
            <ExternalLink className="h-4 w-4" /> Manage billing
          </Button>
        )}
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Current plan</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Badge className="uppercase">{plan}</Badge>
              {status && <span className="text-xs text-muted-foreground">· {status}</span>}
              {subscription?.currentPeriodEnd && (
                <span className="text-xs text-muted-foreground">
                  · renews {formatDate(subscription.currentPeriodEnd, "MMM d, yyyy")}
                </span>
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {PLANS[plan as keyof typeof PLANS]?.description ?? "Free plan"}
        </CardContent>
      </Card>

      {/* Billing toggle */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border bg-muted p-0.5 text-xs">
          <button
            onClick={() => setBilling("monthly")}
            className={cn("rounded-md px-3 py-1.5 font-medium", billing === "monthly" && "bg-background shadow-sm")}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={cn("rounded-md px-3 py-1.5 font-medium", billing === "yearly" && "bg-background shadow-sm")}
          >
            Yearly <span className="text-emerald-600">-17%</span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["FREE", "PRO", "BUSINESS", "ENTERPRISE"] as const).map((p) => {
          const def = PLANS[p];
          const active = plan === p;
          return (
            <Card key={p} className={cn("flex flex-col", active && "ring-2 ring-primary")}>
              <CardHeader>
                <CardTitle className="text-sm">{def.name}</CardTitle>
                <CardDescription className="min-h-[2rem] text-xs">{def.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="mb-4">
                  <span className="text-2xl font-bold">{price(def, billing === "yearly")}</span>
                  <span className="text-xs text-muted-foreground">
                    {def.priceMonthlyCents === null || def.priceMonthlyCents === 0 ? "" : " /mo"}
                  </span>
                </div>
                <ul className="mb-6 space-y-1.5 text-xs text-muted-foreground">
                  {perks[p].map((perk) => (
                    <li key={perk} className="flex items-center gap-2">
                      <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {active ? (
                    <Button disabled className="w-full" variant="outline">
                      Current plan
                    </Button>
                  ) : p === "ENTERPRISE" ? (
                    <Button variant="outline" className="w-full" asChild>
                      <a href="mailto:sales@taskflow.app?subject=Enterprise%20plan">Contact sales</a>
                    </Button>
                  ) : !isOwner ? (
                    <Button disabled className="w-full">
                      Ask an owner to upgrade
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      disabled={pendingPlan !== null}
                      onClick={() => void buy(p)}
                    >
                      {pendingPlan === p ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="mr-2 h-4 w-4" />
                      )}
                      Upgrade to {def.name}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isOwner && plan !== "FREE" && (
        <div className="flex items-center justify-between rounded-lg border border-dashed p-4 text-sm">
          <div>
            <p className="font-medium">Need to scale down?</p>
            <p className="text-muted-foreground">Downgrading to Free applies the Free plan limits immediately.</p>
          </div>
          <Button variant="ghost" className="text-destructive" onClick={() => void downgrade()}>
            Downgrade to Free
          </Button>
        </div>
      )}
    </div>
  );
}