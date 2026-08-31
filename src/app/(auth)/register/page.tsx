import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-gate";
import { getDictionary } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/dictionaries";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session?.user?.id) redirect("/app");

  const dict = await getDictionary();
  const t = (key: keyof typeof dict) => translate(dict, key);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-2xl font-bold tracking-tight text-center mb-6">
          TaskFlow
        </Link>
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <h2 className="text-2xl font-bold">{t("auth.getStarted")}</h2>
          <p className="text-muted-foreground mb-6">
            {t("auth.registerSubtitle")}
          </p>
          <RegisterForm />
          <p className="mt-6 text-sm text-muted-foreground text-center">
            {t("auth.haveAccount")}{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              {t("auth.signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}