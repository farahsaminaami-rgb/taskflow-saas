import { authConfig } from "@/lib/auth.config";
import NextAuth from "next-auth";

const { auth } = NextAuth(authConfig);

export default auth(() => {
  // `authorized` callback in auth.config handles the routing decision; this
  // function solely forwards. Keep it minimal to stay Edge-compatible.
  return;
});

export const config = {
  matcher: [
    // Match app pages + auth pages; skip static assets & API webhooks.
    "/app/:path*",
    "/login",
    "/register",
  ],
};