import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-gate";
import { getDictionary } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/dictionaries";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user?.id) redirect("/app");

  const dict = await getDictionary();
  const t = (key: keyof typeof dict) => translate(dict, key);

  return (
    <AuthShell
      headline={t("auth.heroTitle")}
      subtitle={t("auth.heroSubtitle")}
      footer={t("auth.footer")}
      features={[
        t("auth.feature.realtime"),
        t("auth.feature.sync"),
        t("auth.feature.analytics"),
        t("auth.feature.timer"),
        t("auth.feature.security"),
      ]}
      aside={
        <>
          {t("auth.noAccount")}{" "}
          <Link
            href="/register"
            className="font-semibold text-indigo-300 transition-colors hover:text-indigo-200"
          >
            {t("auth.createOne")}
          </Link>
        </>
      }
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">{t("auth.loginTitle")}</h2>
        <p className="mt-1.5 text-sm text-white/50">{t("auth.loginSubtitle")}</p>
      </div>

      <LoginForm />
    </AuthShell>
  );
}
