"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogOut, UserRound, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { logoutAction } from "@/actions/auth.actions";
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
import { initials } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client-provider";

export function UserMenu() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const user = session?.user;

  async function handleLogout() {
    const result = await logoutAction();
    if (result.ok) {
      router.push("/login");
      router.refresh();
    } else {
      toast.error(t("menu.signOutError"));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="iconSm" className="rounded-full" aria-label={t("menu.accountMenuAria")}>
          <Avatar className="h-7 w-7">
            {user?.image ? <AvatarImage src={user.image} alt={user.name ?? ""} /> : null}
            <AvatarFallback>{initials(user?.name, "U")}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name ?? t("menu.user")}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun /> : <Moon />}
          {t("menu.toggleDark")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/app/account")}>
          <UserRound /> {t("menu.account")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleLogout()} className="text-destructive focus:text-destructive">
          <LogOut /> {t("menu.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}