import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Single auth instance shared by route handlers / server actions / components.
 * Re-exported `handlers` wire up `app/api/auth/[...nextauth]`.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export type AuthSession = Awaited<ReturnType<typeof auth>>;