"use client";

import * as React from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "./client-provider";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t, setLocale } = useI18n();
  const next = locale === "en" ? "ar" : "en";

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => setLocale(next)}
      aria-label={t("language.label")}
      title={t("language.label")}
    >
      <Languages className="h-4 w-4" />
      <span className="text-xs font-medium">{next === "ar" ? "العربية" : "English"}</span>
    </Button>
  );
}