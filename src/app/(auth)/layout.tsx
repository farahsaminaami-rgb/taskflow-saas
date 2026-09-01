import { Languages } from "lucide-react";
import { LanguageSwitcher } from "@/lib/i18n/language-switcher";

/**
 * Authentication pages are always rendered on the dark auth shell, so the
 * language switcher is placed inside a forced `dark` context and styled as a
 * subtle glass pill to sit neatly over the `#090d16` background regardless of
 * the user's chosen theme.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="dark fixed end-4 top-4 z-50">
        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-1 backdrop-blur-sm">
          <Languages className="ms-2 h-4 w-4 text-zinc-400" aria-hidden />
          <LanguageSwitcher />
        </div>
      </div>
      {children}
    </div>
  );
}
