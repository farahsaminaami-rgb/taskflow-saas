import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-gate";
import { getDictionary } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/dictionaries";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session?.user?.id) redirect("/app");

  const dict = await getDictionary();
  const t = (key: keyof typeof dict) => translate(dict, key);

  return (
    <AuthShell
      title={t("auth.getStarted")}
      subtitle={t("auth.registerSubtitle")}
      footerLink={
        <>
          {t("auth.haveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-400 transition-colors hover:text-indigo-300"
          >
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
