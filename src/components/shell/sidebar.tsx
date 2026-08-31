"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  FolderKanban,
  Users,
  BarChart3,
  CreditCard,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n/client-provider";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface NavItem {
  label: keyof Dictionary;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function buildNavItems(slug: string): NavItem[] {
  const base = `/app/workspace/${slug}`;
  return [
    { label: "nav.dashboard", href: `${base}`, icon: LayoutDashboard },
    { label: "nav.projects", href: `${base}/projects`, icon: FolderKanban },
    { label: "nav.board", href: `${base}/board`, icon: ClipboardList },
    { label: "nav.members", href: `${base}/members`, icon: Users },
    { label: "nav.analytics", href: `${base}/analytics`, icon: BarChart3 },
    { label: "nav.billing", href: `${base}/billing`, icon: CreditCard },
    { label: "nav.settings", href: `${base}/settings`, icon: Settings },
  ];
}

export function SidebarNav({ slug, collapsed }: { slug: string; collapsed: boolean }) {
  const pathname = usePathname();
  const { t, dir } = useI18n();
  const items = buildNavItems(slug);

  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const inner = (
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-2 text-foreground/70 hover:text-foreground",
              active && "bg-accent text-foreground",
              collapsed && "px-2"
            )}
            asChild
          >
            <Link href={item.href}>
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{t(item.label)}</span>}
            </Link>
          </Button>
        );
        if (collapsed) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{inner}</TooltipTrigger>
              <TooltipContent side={dir === "rtl" ? "left" : "right"}>{t(item.label)}</TooltipContent>
            </Tooltip>
          );
        }
        return (
          <div key={item.href} className="relative">
            {inner}
            {active && <span className="absolute -start-3 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-s bg-primary" />}
          </div>
        );
      })}

      {!collapsed && (
        <div className="mt-auto rounded-lg border border-dashed p-3 text-xs text-muted-foreground flex items-start gap-2 pt-3">
          <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <span>
            {t("sidebar.promo")}
          </span>
        </div>
      )}
    </nav>
  );
}