"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, ChevronsUpDown, Building2 } from "lucide-react";
import { toast } from "sonner";
import { switchWorkspaceAction } from "@/actions/workspace.actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials, cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client-provider";

export interface WorkspaceOption {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: string;
  role: string;
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string | null;
  activeSlug?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  async function switchTo(id: string) {
    if (id === activeWorkspaceId) return;
    const result = await switchWorkspaceAction(id);
    if (result.ok) {
      const target = workspaces.find((w) => w.id === id);
      router.push(target ? `/app/workspace/${target.slug}` : "/app");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const createHref = () => `/app/create?returnTo=${encodeURIComponent(pathname)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between gap-2 px-2 font-medium"
          aria-label={t("header.switchWorkspace")}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Avatar className="h-6 w-6 rounded-md">
              {active?.logoUrl ? <AvatarImage src={active.logoUrl} /> : null}
              <AvatarFallback className="rounded-md bg-primary/10 text-[10px] text-primary">
                {initials(active?.name ?? "W", "W")}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{active?.name ?? t("header.selectWorkspace")}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t("header.workspaces")}
        </DropdownMenuLabel>
        {workspaces.map((ws) => {
          const isActive = ws.id === active?.id;
          const href = `/app/workspace/${ws.slug}`;
          return (
            <DropdownMenuItem
              key={ws.id}
              onSelect={(e) => {
                e.preventDefault();
                void switchTo(ws.id);
              }}
              className={cn("gap-2", isActive && "bg-accent")}
            >
              <Avatar className="h-6 w-6 rounded-md">
                {ws.logoUrl ? <AvatarImage src={ws.logoUrl} /> : null}
                <AvatarFallback className="rounded-md bg-primary/10 text-[10px] text-primary">
                  {initials(ws.name, "W")}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">
                <span className="block truncate">{ws.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {ws.plan.toLowerCase()} · {ws.role.toLowerCase()}
                </span>
              </span>
              {isActive ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Link
                  href={href}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-label={`Open ${ws.name}`}
                >
                  <Building2 className="h-4 w-4" />
                </Link>
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(createHref())}>
          <Plus className="h-4 w-4" />
          {t("header.createWorkspace")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}