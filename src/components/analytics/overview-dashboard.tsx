"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  CircleAlert,
  DollarSign,
  FileText,
  History,
  ListChecks,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, timeAgo, formatMoney } from "@/lib/utils";
import { BurndownChart } from "@/components/analytics/burndown-chart";
import { ActivityTrendChart } from "@/components/analytics/activity-trend-chart";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { useI18n } from "@/lib/i18n/client-provider";

export interface OverviewData {
  totalTasks: number;
  doneCount: number;
  completionRate: number;
  overdueCount: number;
  byStatus: Array<{ columnId: string; name: string; category: string | null; count: number; color: string }>;
  byPriority: Array<{ priority: string; count: number }>;
  memberTotals: Array<{
    user: { id: string; name: string | null; image: string | null };
    done: number;
    total: number;
  }>;
  tags: Array<{ id: string; name: string; color: string }>;
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function activityLabel(action: string, meta: Record<string, unknown>, t: TranslateFn): string {
  const name = typeof meta?.name === "string" ? meta.name : undefined;
  const number = typeof meta?.number === "string" ? meta.number : undefined;
  switch (action) {
    case "project.created":
    case "project.updated":
    case "project.archived":
      return name ? t(`act.${action}`, { name }) : t("act.generic");
    case "client.created":
    case "client.updated":
    case "client.archived":
      return name ? t(`act.${action}`, { name }) : t("act.generic");
    case "invoice.created":
    case "invoice.updated":
    case "invoice.sent":
    case "invoice.paid":
    case "invoice.cancelled":
      return number ? t(`act.${action}`, { number }) : t("act.generic");
    case "ai.asked":
      return t("act.ai.asked");
    case "workspace.updated":
      return t("act.workspace.updated");
    default:
      return t("act.generic");
  }
}

export function OverviewDashboard({
  overview,
  burndown,
  trend,
  projects,
  role,
  clientCount,
  summary,
  activity,
}: {
  overview: OverviewData;
  burndown: Array<{ day: string; opened: number; closed: number; remaining: number }>;
  trend: Array<{ label: string; created: number; completed: number }>;
  projects: Array<{ id: string; name: string; key: string; color: string }>;
  role: string;
  clientCount: number;
  summary: { outstanding: number; paid: number; overdue: number; count: number };
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    meta: Record<string, unknown>;
    createdAt: string;
    actor: { id: string; name: string | null; image: string | null } | null;
  }>;
}) {
  const { slug } = useWorkspace();
  const { t } = useI18n();

  const cards = [
    {
      label: t("overview.totalTasks"),
      value: overview.totalTasks,
      icon: ListChecks,
      hint: t("overview.hintAllProjects"),
    },
    {
      label: t("overview.completionRate"),
      value: `${overview.completionRate}%`,
      icon: TrendingUp,
      hint: t("overview.hintDoneOf", { done: overview.doneCount, total: overview.totalTasks }),
    },
    {
      label: t("overview.overdue"),
      value: overview.overdueCount,
      icon: CircleAlert,
      hint: t("overview.hintNeedAttention"),
      alert: overview.overdueCount > 0,
    },
    {
      label: t("overview.done"),
      value: overview.doneCount,
      icon: CheckCircle2,
      hint: t("overview.hintTotalCompleted"),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("overview.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("overview.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href={`/app/workspace/${slug}/projects`}>{t("overview.newProject")}</Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.alert ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Business overview */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-semibold">{t("dash.business")}</h3>
          <p className="text-xs text-muted-foreground">{t("dash.businessDesc")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dash.clients")}</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientCount}</div>
              <p className="text-xs text-muted-foreground">{t("dash.clientsHint")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dash.revenue")}</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(summary.paid)}</div>
              <p className="text-xs text-muted-foreground">{summary.count ? t("dash.invoicesSent", { count: summary.count }) : ""}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dash.outstanding")}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(summary.outstanding)}</div>
              <p className="text-xs text-muted-foreground">{t("overview.hintNeedAttention")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dash.overdue")}</CardTitle>
              <CircleAlert className={`h-4 w-4 ${summary.overdue > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.overdue > 0 ? "text-destructive" : ""}`}>{formatMoney(summary.overdue)}</div>
              <p className="text-xs text-muted-foreground">{summary.count} {t("inv.status.OVERDUE")}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Burn-down */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              {t("overview.burndown")}
            </CardTitle>
            <CardDescription>{t("overview.burndownDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            <BurndownChart data={burndown} />
          </CardContent>
        </Card>

        {/* Completion by column */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("overview.byStatus")}</CardTitle>
            <CardDescription>{t("overview.byStatusDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.byStatus.map((s) => (
              <div key={s.columnId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </span>
                  <span className="font-medium">{s.count}</span>
                </div>
                <Progress
                  value={overview.totalTasks ? (s.count / overview.totalTasks) * 100 : 0}
                  className="bg-muted"
                />
              </div>
            ))}
            {overview.byStatus.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("overview.noTasks")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend + top performers row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">{t("overview.createdVsCompleted")}</CardTitle>
            <CardDescription>{t("overview.throughput")}</CardDescription>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ActivityTrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("overview.topContributors")}</CardTitle>
            <CardDescription>{t("overview.byTasksCompleted")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.memberTotals.slice(0, 5).map((m, i) => (
              <div key={m.user.id + i} className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground w-4">{i + 1}</span>
                <Avatar className="h-7 w-7">
                  {m.user.image ? <AvatarImage src={m.user.image} /> : null}
                  <AvatarFallback>{initials(m.user.name, "?")}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.user.name ?? t("overview.unknown")}</p>
                  <p className="text-xs text-muted-foreground">{t("overview.tasksAssigned", { total: m.total })}</p>
                </div>
                <Badge variant="success">{t("overview.doneBadge", { done: m.done })}</Badge>
              </div>
            ))}
            {overview.memberTotals.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("overview.noContributions")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent projects */}
      {projects.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">{t("overview.latestProjects")}</CardTitle>
              <CardDescription>{t("overview.jumpStraight")}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/app/workspace/${slug}/projects`}>{t("overview.viewAll")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/app/workspace/${slug}/board?project=${p.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold text-white" style={{ backgroundColor: p.color }}>
                  {p.key.slice(0, 3)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.key}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="h-4 w-4 text-muted-foreground" />
              {t("dash.activity")}
            </CardTitle>
            <CardDescription>{t("dash.activityDesc")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {activity.length > 0 ? (
            <ul className="space-y-1">
              {activity.map((a) => {
                const label = activityLabel(a.action, a.meta, t);
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/40">
                    <Avatar className="h-7 w-7">
                      {a.actor?.image ? <AvatarImage src={a.actor.image} /> : null}
                      <AvatarFallback>{initials(a.actor?.name, "?")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <span className="font-medium">{a.actor?.name ?? "Someone"} </span>
                        {label}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("dash.noActivity")}</p>
          )}
        </CardContent>
      </Card>

      {/* Role banner for viewers */}
      {role === "VIEWER" && (        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t("overview.viewerBannerPre")} <Badge variant="secondary">{t("overview.viewerBadge")}</Badge>{" "}
          {t("overview.viewerBanner")}
        </div>
      )}
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[320px] rounded-lg" />
        <Skeleton className="h-[320px] rounded-lg" />
      </div>
    </div>
  );
}