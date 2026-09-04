"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-gate";
import { clientService } from "@/services/client.service";
import { createClientSchema, updateClientSchema } from "@/lib/validators";
import { ActionResult, fail, ok } from "@/lib/validators";

export async function createClientAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const parsed = createClientSchema.safeParse(input);
    if (!parsed.success) return fail("Please fix the highlighted fields.");
    const client = await clientService.create(workspaceId, session.user.id, parsed.data);
    revalidatePath(`/app/workspace/${workspaceId}/clients`);
    return ok({ id: client.id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create the client.");
  }
}

export async function updateClientAction(
  workspaceId: string,
  clientId: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = updateClientSchema.safeParse(input);
    if (!parsed.success) return fail("Please fix the highlighted fields.");
    await clientService.update(workspaceId, session.user.id, clientId, parsed.data);
    revalidatePath(`/app/workspace/${workspaceId}/clients`);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update the client.");
  }
}

export async function archiveClientAction(
  workspaceId: string,
  clientId: string,
  archived: boolean
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await clientService.archive(workspaceId, session.user.id, clientId, archived);
    revalidatePath(`/app/workspace/${workspaceId}/clients`);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update the client.");
  }
}
