"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { GoogleIcon } from "@/components/auth/google-icon";
import { loginAction } from "@/actions/auth.actions";
import { useI18n } from "@/lib/i18n/client-provider";

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const result = await loginAction({
        email: form.get("email"),
        password: form.get("password"),
      });
      if (result.ok) {
        router.push("/app");
        router.refresh();
      } else {
        setError(result.error);
        toast.error(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm text-zinc-300">
          {t("auth.email")}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t("auth.emailPlaceholder")}
          required
          autoComplete="email"
          className="bg-zinc-900/80 border-zinc-800 text-zinc-50 placeholder:text-zinc-500"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-sm text-zinc-300">
            {t("auth.password")}
          </Label>
          <button
            type="button"
            className="text-xs font-medium text-indigo-400/90 transition-colors hover:text-indigo-300"
          >
            {t("auth.forgotPassword")}
          </button>
        </div>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          className="bg-zinc-900/80 border-zinc-800 text-zinc-50 placeholder:text-zinc-500"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <SubmitButton loading={pending} loadingLabel={t("auth.signingIn")}>
        {t("auth.signIn")}
      </SubmitButton>

      {process.env.NEXT_PUBLIC_ENABLE_OAUTH === "true" && (
        <div className="space-y-4 pt-1">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#111827] px-3 text-xs text-zinc-500">
                {t("auth.orContinueWith")}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/app" })}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-zinc-700/70 bg-zinc-900 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
          >
            <GoogleIcon />
            <span>{t("auth.signInWithGoogle")}</span>
          </button>
        </div>
      )}
    </form>
  );
}
