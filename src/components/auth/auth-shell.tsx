import type { ReactNode } from "react";
import { KanbanSquare } from "lucide-react";

/**
 * Shared, high-end dark authentication shell used by both /login and /register.
 *
 * - Deep neutral `#090d16` background with subtle ambient glows — no aggressive
 *   full-bleed gradient.
 * - Centers a sophisticated glassmorphism card (`#111827`, `backdrop-blur-sm`,
 *   `border-white/10`, `rounded-2xl`) with a clean TaskFlow logo inside.
 * - Forces the `dark` token set so every descendant renders with the sleek dark
 *   palette regardless of the user's theme, and follows the document `dir`
 *   (LTR / RTL) automatically.
 *
 * Text is supplied via props so server pages can pass fully translated strings
 * (the app ships English + Arabic / RTL).
 */
export function AuthShell({
  title,
  subtitle,
  footerLink,
  children,
}: {
  title: string;
  subtitle: string;
  footerLink: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="dark relative min-h-screen overflow-hidden bg-[#090d16] text-zinc-50">
      <Background />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/10 bg-[#111827]/90 p-7 shadow-2xl shadow-black/50 backdrop-blur-sm sm:p-9">
            {/* Brand inside the card */}
            <div className="mb-7 flex justify-center">
              <Brand />
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-[1.6rem]">
                {title}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">
                {subtitle}
              </p>
            </div>

            <div className="mt-7">{children}</div>
          </div>

          <div className="mt-6 text-center text-sm text-zinc-400">
            {footerLink}
          </div>
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-900/40">
        <KanbanSquare className="h-5 w-5 text-white" />
      </span>
      <span className="text-xl font-bold tracking-tight text-zinc-50">
        TaskFlow
      </span>
    </span>
  );
}

function Background() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* Ambient glows — subtle, neutral, professional */}
      <div className="absolute -top-32 left-1/2 h-[28rem] w-[36rem] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-[150px]" />
      <div className="absolute bottom-[-10rem] right-[-6rem] h-[24rem] w-[24rem] rounded-full bg-violet-600/10 blur-[150px]" />
      <div className="absolute bottom-[-8rem] left-[-6rem] h-[20rem] w-[20rem] rounded-full bg-sky-600/10 blur-[140px]" />
      {/* Hairline grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
    </div>
  );
}
