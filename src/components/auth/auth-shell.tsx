import type { ReactNode } from "react";
import {
  KanbanSquare,
  Radio,
  BarChart3,
  Timer,
  ShieldCheck,
} from "lucide-react";

/**
 * Shared, high-end dark authentication shell used by both /login and /register.
 *
 * - Forces the `dark` token set so every descendant (inputs, borders, muted
 *   text) renders with the sleek dark palette regardless of the user's theme.
 * - Layered radial "mesh" glows + a hairline grid provide depth without the
 *   old aggressive full-bleed purple gradient.
 *
 * Text is supplied via props so server pages can pass fully translated strings
 * (the app ships English + Arabic / RTL).
 */
export function AuthShell({
  headline,
  subtitle,
  features,
  footer,
  aside,
  children,
}: {
  headline: string;
  subtitle: string;
  features: string[];
  footer: string;
  aside: ReactNode;
  children: ReactNode;
}) {
  const featureIcons = [KanbanSquare, Radio, BarChart3, Timer, ShieldCheck];

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-[#090d16] text-white">
      <Background />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* Left: brand + product showcase (hidden on small screens) */}
        <aside className="hidden lg:flex flex-col justify-between px-14 py-12 border-e border-white/[0.06]">
          <Brand />

          <div className="max-w-md">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              {headline}
            </h1>
            <p className="mt-4 leading-relaxed text-white/55">{subtitle}</p>

            <ul className="mt-10 space-y-5">
              {features.map((text, i) => {
                const Icon = featureIcons[i % featureIcons.length];
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-indigo-300">
                      {Icon ? <Icon className="h-4 w-4" /> : null}
                    </span>
                    <span className="text-[15px] text-white/75">{text}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="text-sm text-white/35">{footer}</p>
        </aside>

        {/* Right: auth card */}
        <main className="flex items-center justify-center px-6 py-14 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
              <Brand />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-9">
              {children}
            </div>

            <div className="mt-6 text-center text-sm text-white/45">{aside}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30">
        <KanbanSquare className="h-5 w-5 text-white" />
      </span>
      <span className="text-xl font-bold tracking-tight">TaskFlow</span>
    </span>
  );
}

function Background() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* Mesh glows */}
      <div className="absolute -top-40 left-1/4 h-[36rem] w-[36rem] rounded-full bg-indigo-600/20 blur-[140px]" />
      <div className="absolute bottom-[-12rem] right-0 h-[30rem] w-[30rem] rounded-full bg-violet-600/15 blur-[160px]" />
      <div className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-fuchsia-600/10 blur-[120px]" />
      {/* Hairline grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
    </div>
  );
}
