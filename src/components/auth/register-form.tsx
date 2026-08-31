"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/actions/auth.actions";
import type { ActionResult } from "@/lib/validators";
import { useI18n } from "@/lib/i18n/client-provider";

export function RegisterForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [authError, setAuthError] = useState<string | null>(null);

  function applyErrors(result: ActionResult, name: string) {
    const e = result as { ok: false; error: string; fieldErrors?: Record<string, string[]> };
    setAuthError(e.error ?? null);
    setFieldErrors(e.fieldErrors ?? {});
    if (e.error && !e.fieldErrors) toast.error(e.error);
    void name;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setFieldErrors({});
    setAuthError(null);
    try {
      const result = await registerAction({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        confirmPassword: form.get("confirmPassword"),
      });
      if (result.ok) {
        toast.success(t("auth.welcomeToast"));
        router.push("/app");
        router.refresh();
      } else {
        applyErrors(result, "register");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">{t("auth.fullName")}</Label>
        <Input id="name" name="name" placeholder={t("auth.namePlaceholder")} required autoComplete="name" />
        {fieldErrors.name?.map((m) => (
          <p key={m} className="text-sm text-destructive">
            {m}
          </p>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input id="email" name="email" type="email" placeholder={t("auth.emailPlaceholder")} required autoComplete="email" />
        {fieldErrors.email?.map((m) => (
          <p key={m} className="text-sm text-destructive">
            {m}
          </p>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input id="password" name="password" type="password" required autoComplete="new-password" />
        {fieldErrors.password?.map((m) => (
          <p key={m} className="text-sm text-destructive">
            {m}
          </p>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
        {fieldErrors.confirmPassword?.map((m) => (
          <p key={m} className="text-sm text-destructive">
            {m}
          </p>
        ))}
      </div>

      {authError && !fieldErrors.email && <p className="text-sm text-destructive">{authError}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? t("auth.creatingAccount") : t("auth.createAccount")}
      </Button>
    </form>
  );
}