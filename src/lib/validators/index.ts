export * from "./auth";
export * from "./workspace";
export * from "./task";
export * from "./query";
export * from "./crm";

import { z } from "zod";

/** Generic server-action result envelope. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Parse & flatten a Zod error into React-accessible field errors. */
export function zodResult<T>(schema: z.ZodType<T>, input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    throw new ValidationError("Invalid input", fieldErrors);
  }
  return parsed.data;
}

export class ValidationError extends Error {
  fieldErrors: Record<string, string[]>;
  constructor(message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/**
 * `callAction` wraps a server action so UI code can invoke it without managing
 * the try/catch dance, and hydrates field errors for forms automatically.
 */
export async function callAction<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fn: (parsed: T) => Promise<ActionResult>
): Promise<ActionResult> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_";
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }
      return fail("Invalid input", fieldErrors);
    }
    return await fn(parsed.data);
  } catch (error) {
    if (error instanceof ValidationError) {
      return fail(error.message, error.fieldErrors);
    }
    console.error("[action] unexpected error:", error);
    return fail("Something went wrong. Please try again.");
  }
}