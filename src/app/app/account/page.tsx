"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/client-provider";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const { t } = useI18n();

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("account.loading")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("account.title")}</CardTitle>
          <CardDescription>{t("account.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.name ?? t("account.unnamed")}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            {t("account.signOut")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}