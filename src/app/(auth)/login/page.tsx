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
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
      footerLink={
        <>
          {t("auth.noAccount")}{" "}
          <Link
            href="/register"
            className="font-medium text-indigo-400 transition-colors hover:text-indigo-300"
          >
            {t("auth.createOne")}
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
