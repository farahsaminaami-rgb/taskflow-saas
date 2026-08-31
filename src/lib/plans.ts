// ============================================================================
// SaaS plan tier definitions (source of truth for limits + Stripe pricing).
// Kept as static config so limits are trivially introspectable client-side;
// the DB snapshots the active plan per workspace (`workspaces.plan`).
// ============================================================================

import type { SubscriptionPlan } from "@prisma/client";

export interface PlanLimits {
  /** Maximum active members per workspace (null = unlimited). */
  maxMembers: number | null;
  /** Maximum projects per workspace (null = unlimited). */
  maxProjects: number | null;
  /** Maximum tasks per project (null = unlimited). */
  maxTasksPerProject: number | null;
  /** Attachments per task. */
  maxAttachmentsPerTask: number;
  /** Max file size in MB. */
  maxAttachmentSizeMb: number;
  /** Advanced analytics / time-tracking reporting. */
  analytics: boolean;
  /** Fine-grained permissions (roles beyond Member/Viewer). */
  advancedRoles: boolean;
}

export interface PlanDefinition extends PlanLimits {
  id: SubscriptionPlan;
  name: string;
  priceMonthlyCents: number | null;
  priceYearlyCents: number | null;
  /** Stripe Price ids — populated when billing is configured. */
  stripePriceMonthlyId: string | null;
  stripePriceYearlyId: string | null;
  description: string;
}

export const PLANS: Record<SubscriptionPlan, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free",
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    stripePriceMonthlyId: null,
    stripePriceYearlyId: null,
    description: "For individuals and small teams getting started.",
    maxMembers: 5,
    maxProjects: 3,
    maxTasksPerProject: 100,
    maxAttachmentsPerTask: 10,
    maxAttachmentSizeMb: 10,
    analytics: true,
    advancedRoles: false,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceMonthlyCents: 1200,
    priceYearlyCents: 12000,
    stripePriceMonthlyId: null,
    stripePriceYearlyId: null,
    description: "Unlimited projects & members for growing teams.",
    maxMembers: null,
    maxProjects: null,
    maxTasksPerProject: null,
    maxAttachmentsPerTask: 50,
    maxAttachmentSizeMb: 50,
    analytics: true,
    advancedRoles: true,
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    priceMonthlyCents: 2900,
    priceYearlyCents: 29000,
    stripePriceMonthlyId: null,
    stripePriceYearlyId: null,
    description: "Advanced permissions, priorities and audit trail.",
    maxMembers: null,
    maxProjects: null,
    maxTasksPerProject: null,
    maxAttachmentsPerTask: 100,
    maxAttachmentSizeMb: 100,
    analytics: true,
    advancedRoles: true,
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    priceMonthlyCents: null,
    priceYearlyCents: null,
    stripePriceMonthlyId: null,
    stripePriceYearlyId: null,
    description: "Custom onboarding, SSO and support SLA.",
    maxMembers: null,
    maxProjects: null,
    maxTasksPerProject: null,
    maxAttachmentsPerTask: 500,
    maxAttachmentSizeMb: 250,
    analytics: true,
    advancedRoles: true,
  },
};

export const FREE_PLAN = PLANS.FREE;

export function getPlan(plan: SubscriptionPlan = "FREE"): PlanDefinition {
  return PLANS[plan] ?? FREE_PLAN;
}

/** Simple hard check used server-side before creating tenant-scoped rows. */
export interface PlanCheckResult {
  allowed: boolean;
  reason?: string;
}

export function assertMemberLimit(
  plan: SubscriptionPlan,
  currentActiveMembers: number,
  newMembers = 1
): PlanCheckResult {
  const { maxMembers } = getPlan(plan);
  if (maxMembers === null) return { allowed: true };
  if (currentActiveMembers + newMembers > maxMembers) {
    return {
      allowed: false,
      reason: `Plan ${plan} allows up to ${maxMembers} members. Upgrade to Pro for unlimited members.`,
    };
  }
  return { allowed: true };
}

export function assertProjectLimit(
  plan: SubscriptionPlan,
  currentActiveProjects: number
): PlanCheckResult {
  const { maxProjects } = getPlan(plan);
  if (maxProjects === null) return { allowed: true };
  if (currentActiveProjects >= maxProjects) {
    return {
      allowed: false,
      reason: `Plan ${plan} allows up to ${maxProjects} projects. Upgrade to Pro for unlimited projects.`,
    };
  }
  return { allowed: true };
}

export function assertTaskLimit(
  plan: SubscriptionPlan,
  currentTasks: number
): PlanCheckResult {
  const { maxTasksPerProject } = getPlan(plan);
  if (maxTasksPerProject === null) return { allowed: true };
  if (currentTasks >= maxTasksPerProject) {
    return {
      allowed: false,
      reason: `Plan ${plan} allows up to ${maxTasksPerProject} tasks per project.`,
    };
  }
  return { allowed: true };
}