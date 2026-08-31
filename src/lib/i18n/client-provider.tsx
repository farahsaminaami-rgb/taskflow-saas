"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { dirFor, type Locale } from "./config";
import { dictionaries, translate, type Dictionary } from "./dictionaries";

export type Translate = (key: keyof Dictionary, params?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Translate;
  setLocale: (locale: Locale) => void;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const dict = dictionaries[locale];

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: dirFor(locale),
      t: (key, params) => translate(dict, key, params),
      setLocale: (next) => {
        const current = document.documentElement.getAttribute("lang");
        if (next === current) return;
        document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.lang = next;
        document.documentElement.dir = dirFor(next);
        router.refresh();
      },
    }),
    [locale, dict, router]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}