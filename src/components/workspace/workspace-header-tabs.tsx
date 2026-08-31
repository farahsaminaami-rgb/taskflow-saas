"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Users,
  BarChart3,
  CreditCard,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/client-provider";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const tabs = (slug: string): Array<{ label: keyof Dictionary; href: string; icon: React.ComponentType<{ className?: string }> }> => {
  const base = `/app/workspace/${slug}`;
  return [
    { label: "nav.overview", href: `${base}`, icon: LayoutDashboard },
    { label: "nav.projects", href: `${base}/projects`, icon: FolderKanban },
    { label: "nav.board", href: `${base}/board`, icon: ClipboardList },
    { label: "nav.members", href: `${base}/members`, icon: Users },
    { label: "nav.analytics", href: `${base}/analytics`, icon: BarChart3 },
    { label: "nav.billing", href: `${base}/billing`, icon: CreditCard },
    { label: "nav.settings", href: `${base}/settings`, icon: Settings },
  ];
};

export function WorkspaceHeaderTabs({
  workspaceId,
  slug,
  name,
  plan,
}: {
  workspaceId: string;
  slug: string;
  name: string;
  plan: string;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  void workspaceId;

  return (
    <div className="border-b bg-background">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-14 items-center justify-between">
          <h1 className="truncate text-lg font-semibold tracking-tight">{name}</h1>
          <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">
            {plan}
          </Badge>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-0">
          {tabs(slug).map((tab) => {
            const active = pathname === tab.href || (tab.href !== `/app/workspace/${slug}` && pathname.startsWith(tab.href));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {t(tab.label)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}