import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

/**
 * Edge-safe NextAuth configuration.
 *
 * This module is imported by `src/middleware.ts`, which Netlify bundles as an
 * Edge Function. That imposes a hard constraint: it must NOT import any
 * Node.js-only module (no `bcryptjs`, no Prisma, no `pg`). The real
 * credentials `authorize` (which performs DB + bcrypt work) lives in
 * `src/lib/auth.ts` and replaces this stub at composition time.
 *
 * - The `authorized` callback performs NO database access; authorization is
 *   enforced later in server components / server actions via `auth-gate.ts`.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Edge-safe stub. `auth.ts` overrides providers with the real
      // implementation (DB + bcrypt), which never runs on the Edge runtime.
      async authorize() {
        return null;
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(process.env.GITHUB_CLIENT_ID
      ? [
          GitHub({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) token.id = (user as { id: string }).id;
      if (trigger === "update" && session?.activeWorkspaceId) {
        token.activeWorkspaceId = session.activeWorkspaceId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string;
        session.user.activeWorkspaceId = (token.activeWorkspaceId as string | null | undefined) ?? null;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnWorkspaceRoutes = nextUrl.pathname.includes("/app");

      // Auth routes are only reachable by anonymous users.
      if (isOnWorkspaceRoutes) return isLoggedIn;
      if (isLoggedIn && ["/login", "/register"].includes(nextUrl.pathname)) {
        const redirectUrl = new URL("/app", nextUrl);
        return Response.redirect(redirectUrl);
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
