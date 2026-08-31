import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/client-provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { dirFor } from "@/lib/i18n/config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const arabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TaskFlow — Multi-tenant Task Management for SaaS teams",
    template: "%s · TaskFlow",
  },
  description:
    "Production-ready open-source task management platform with Kanban boards, realtime sync, analytics and subscriptions.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning>
      <body className={`${inter.variable} ${arabic.variable} font-sans`}>
        <I18nProvider locale={locale}>
          <ThemeProvider>
            <SessionProvider>
              <QueryProvider>
                {children}
                <Toaster richColors position="bottom-right" />
              </QueryProvider>
            </SessionProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}