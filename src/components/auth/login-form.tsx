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
      <div className="space-y-2">
        <Label htmlFor="email" className="text-white/75">
          {t("auth.email")}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t("auth.emailPlaceholder")}
          required
          autoComplete="email"
          className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-white/75">
            {t("auth.password")}
          </Label>
          <button
            type="button"
            className="text-xs font-medium text-indigo-300/80 hover:text-indigo-200"
          >
            Forgot?
          </button>
        </div>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <SubmitButton loading={pending} loadingLabel={t("auth.signingIn")}>
        {t("auth.signIn")}
      </SubmitButton>

      {process.env.NEXT_PUBLIC_ENABLE_OAUTH === "true" && (
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-[#0d1322] px-2 text-white/40">
                {t("auth.orContinueWith")}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <OAuthButton label={t("auth.google")} onClick={() => signIn("google", { callbackUrl: "/app" })} />
            <OAuthButton label={t("auth.github")} onClick={() => signIn("github", { callbackUrl: "/app" })} />
          </div>
        </div>
      )}
    </form>
  );
}

function OAuthButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 rounded-lg border border-white/10 bg-white/[0.03] text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
    >
      {label}
    </button>
  );
}
