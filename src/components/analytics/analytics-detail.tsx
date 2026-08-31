"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, formatDuration } from "@/lib/utils";

export interface ProductivityRow {
  user: { id: string; name: string | null; image: string | null };
  minutes: number;
  tasksDone: number;
  activeDays: number;
}

export function AnalyticsDetail({ productivity }: { productivity: ProductivityRow[] }) {
  const maxMinutes = Math.max(1, ...productivity.map((p) => p.minutes));

  return (
    <div className="mx-auto max-w-7xl px-6 pb-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Weekly productivity</CardTitle>
          <CardDescription>Time logged and tasks completed over the last 7 days</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {productivity.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No activity yet this week — log time on a task to see it here.
            </p>
          )}
          {productivity.map((p) => (
            <div key={p.user.id} className="flex items-center gap-4">
              <Avatar className="h-8 w-8">
                {p.user.image ? <AvatarImage src={p.user.image} /> : null}
                <AvatarFallback className="text-xs">{initials(p.user.name, "?")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{p.user.name ?? "Unknown"}</p>
                  <span className="shrink-0 text-xs font-medium tabular-nums">
                    {formatDuration(p.minutes)}
                  </span>
                </div>
                <Progress
                  value={maxMinutes ? (p.minutes / maxMinutes) * 100 : 0}
                  className="mt-1 h-2"
                />
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="secondary">{p.tasksDone} tasks done</Badge>
                  <Badge variant="outline">{p.activeDays} active days</Badge>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}