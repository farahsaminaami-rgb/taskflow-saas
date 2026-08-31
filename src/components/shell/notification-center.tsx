"use client";

import * as React from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { enUS, ar as arLocale } from "date-fns/locale";
import { useNotifications } from "@/hooks/use-notifications";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials, cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client-provider";

export function NotificationCenter({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = React.useState(false);
  const { notifications, unread, markRead, markAllRead, isLoading } = useNotifications(workspaceId);
  const { t, dir } = useI18n();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="iconSm" className="relative" aria-label={t("header.notifications")}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t("header.notifications")}</span>
            {unread > 0 && <Badge variant="secondary">{t("header.notificationsNew", { count: unread })}</Badge>}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" /> {t("header.markAllRead")}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[360px]">
          {isLoading && !notifications.length ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 items-start animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t("header.allCaughtUp")}</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.isRead) markRead.mutate([n.id]);
                    if (n.taskId && workspaceId) {
                      // Task-level navigation handled by the board modal.
                    }
                  }}
                  className={cn(
                    "flex w-full gap-3 px-4 py-3 text-start text-sm transition-colors hover:bg-accent/50",
                    !n.isRead && "bg-primary/[0.03]"
                  )}
                >
                  <Avatar className="mt-0.5 h-8 w-8">
                    {n.actor?.image ? <AvatarImage src={n.actor.image} /> : null}
                    <AvatarFallback>{initials(n.actor?.name ?? "?", "?")}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-medium leading-snug", !n.isRead && "text-foreground")}>{n.title}</p>
                    {n.message && <p className="mt-0.5 line-clamp-2 text-muted-foreground">{n.message}</p>}
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {formatDistanceToNowStrict(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: dir === "rtl" ? arLocale : enUS,
                      })}
                    </p>
                  </div>
                  {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}