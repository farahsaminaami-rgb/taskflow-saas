import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-gate";
import { getDictionary } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/dictionaries";import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user?.id) redirect("/app");

  const dict = await getDictionary();
  const t = (key: keyof typeof dict) => translate(dict, key);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-12 text-white">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          TaskFlow
        </Link>
        <div>
          <h1 className="text-4xl font-bold leading-tight max-w-md">
            {t("auth.heroTitle")}
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            {t("auth.heroSubtitle")}
          </p>
        </div>
        <p className="text-white/60 text-sm">{t("auth.heroFooter")}</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold">{t("auth.loginTitle")}</h2>
          <p className="text-muted-foreground mb-6">{t("auth.loginSubtitle")}</p>
          <LoginForm />
          <p className="mt-6 text-sm text-muted-foreground text-center">
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              {t("auth.createOne")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}