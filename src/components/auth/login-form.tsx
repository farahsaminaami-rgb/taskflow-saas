"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/actions/auth.actions";
import { useI18n } from "@/lib/i18n/client-provider";

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    try {
      const result = await loginAction({
        email: form.get("email"),
        password: form.get("password"),
      });
      if (result.ok) {
        router.push("/app");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input id="email" name="email" type="email" placeholder={t("auth.emailPlaceholder")} required autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? t("auth.signingIn") : t("auth.signIn")}
      </Button>

      {process.env.NEXT_PUBLIC_ENABLE_OAUTH === "true" && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">{t("auth.orContinueWith")}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={() => signIn("google", { callbackUrl: "/app" })}>
              {t("auth.google")}
            </Button>
            <Button type="button" variant="outline" onClick={() => signIn("github", { callbackUrl: "/app" })}>
              {t("auth.github")}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}