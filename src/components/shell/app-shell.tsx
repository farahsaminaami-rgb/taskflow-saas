"use client";

import * as React from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeft, Kanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/shell/sidebar";
import { WorkspaceSwitcher, type WorkspaceOption } from "@/components/shell/workspace-switcher";
import { NotificationCenter } from "@/components/shell/notification-center";
import { UserMenu } from "@/components/shell/user-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageSwitcher } from "@/lib/i18n/language-switcher";
import { useI18n } from "@/lib/i18n/client-provider";

export function AppShell({
  workspaces,
  activeWorkspaceId,
  activeSlug,
  children,
}: {
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string | null;
  activeSlug?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const { t } = useI18n();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar */}
        <aside
          className={cn(
            "sticky top-0 flex h-screen shrink-0 flex-col border-s bg-background transition-[width] duration-200",
            collapsed ? "w-14" : "w-60"
          )}
        >
          <div className={cn("flex h-16 items-center gap-2 px-3", collapsed && "justify-center px-0")}>
            {!collapsed && (
              <Link href="/app" className="flex items-center gap-2 font-bold tracking-tight">
                <Kanban className="h-5 w-5 text-primary" />
                TaskFlow
              </Link>
            )}
            {collapsed && (
              <Link href="/app" aria-label={t("header.homeAria")}>
                <Kanban className="h-5 w-5 text-primary" />
              </Link>
            )}
          </div>

          <div className={cn("px-2 pb-2", collapsed && "px-0 flex justify-center")}>
            <WorkspaceSwitcher
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              activeSlug={activeSlug}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeSlug && <SidebarNav slug={activeSlug} collapsed={collapsed} />}
          </div>

          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {!collapsed && <span className="text-xs">{t("sidebar.collapse")}</span>}
            </Button>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur">
            <div className="flex items-center gap-3">
              {/* Breadcrumb slot — pages render their own heading */}
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              {activeWorkspaceId && <NotificationCenter workspaceId={activeWorkspaceId} />}
              <UserMenu />
            </div>
          </header>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}