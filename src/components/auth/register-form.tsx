"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={t("auth.fullName")} error={fieldErrors.name} htmlFor="name">
        <Input
          id="name"
          name="name"
          placeholder={t("auth.namePlaceholder")}
          required
          autoComplete="name"
          className="bg-zinc-900/80 border-zinc-800 text-zinc-50 placeholder:text-zinc-500"
        />
      </Field>

      <Field label={t("auth.email")} error={fieldErrors.email} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t("auth.emailPlaceholder")}
          required
          autoComplete="email"
          className="bg-zinc-900/80 border-zinc-800 text-zinc-50 placeholder:text-zinc-500"
        />
      </Field>

      <Field label={t("auth.password")} error={fieldErrors.password} htmlFor="password">
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="new-password"
          className="bg-zinc-900/80 border-zinc-800 text-zinc-50 placeholder:text-zinc-500"
        />
      </Field>

      <Field
        label={t("auth.confirmPassword")}
        error={fieldErrors.confirmPassword}
        htmlFor="confirmPassword"
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          required
          autoComplete="new-password"
          className="bg-zinc-900/80 border-zinc-800 text-zinc-50 placeholder:text-zinc-500"
        />
      </Field>

      {authError && !fieldErrors.email && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      <SubmitButton loading={pending} loadingLabel={t("auth.creatingAccount")}>
        {t("auth.createAccount")}
      </SubmitButton>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm text-zinc-300">
        {label}
      </Label>
      {children}
      {error?.map((m) => (
        <p key={m} className="text-xs text-red-300">
          {m}
        </p>
      ))}
    </div>
  );
}
