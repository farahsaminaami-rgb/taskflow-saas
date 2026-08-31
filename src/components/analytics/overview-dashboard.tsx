"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  CircleAlert,
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
import { initials } from "@/lib/utils";
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

export function OverviewDashboard({
  overview,
  burndown,
  trend,
  projects,
  role,
}: {
  overview: OverviewData;
  burndown: Array<{ day: string; opened: number; closed: number; remaining: number }>;
  trend: Array<{ label: string; created: number; completed: number }>;
  projects: Array<{ id: string; name: string; key: string; color: string }>;
  role: string;
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

      {/* Role banner for viewers */}
      {role === "VIEWER" && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
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