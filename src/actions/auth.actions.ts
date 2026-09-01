"use server";

import { signIn, signOut } from "@/lib/auth";
import { AuthService } from "@/services/auth.service";
import {
  registerSchema,
  loginSchema,
} from "@/lib/validators/auth";
import { ActionResult, fail, ok } from "@/lib/validators";
import { toUserFacingMessage } from "@/lib/errors";

const authService = new AuthService();

export async function registerAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = [...(fieldErrors[issue.path.join(".")] ?? []), issue.message];
    }
    return fail("Please fix the highlighted fields.", fieldErrors);
  }

  try {
    const user = await authService.register(parsed.data);
    // Email/password accounts get an immediate JWT session.
    await signIn("credentials", {
      email: user.email,
      password: parsed.data.password,
      redirect: false,
    });
    return ok({ email: user.email });
  } catch (error) {
    return fail(toUserFacingMessage(error, "Unable to create your account."));
  }
}

export async function loginAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Enter a valid email and password.");
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return ok({ url: "/app" });
  } catch (error) {
    // Never echo raw credentials / DB errors. Log the cause, return a safe,
    // generic message so users get no hint about internals.
    console.error("[auth] login failed (details hidden from user):", error);
    return fail("Invalid email or password.");
  }
}

export async function logoutAction(): Promise<ActionResult> {
  await signOut({ redirect: false });
  return ok(undefined);
}