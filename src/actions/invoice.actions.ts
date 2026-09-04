"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-gate";
import { invoiceService } from "@/services/invoice.service";
import { createInvoiceSchema, updateInvoiceSchema } from "@/lib/validators";
import { ActionResult, fail, ok } from "@/lib/validators";

export async function createInvoiceAction(
  workspaceId: string,
  input: unknown
): Promise<ActionResult<{ id: string; number: string }>> {
  try {
    const session = await requireSession();
    const parsed = createInvoiceSchema.safeParse(input);
    if (!parsed.success) return fail("Please fix the highlighted fields.");
    const invoice = await invoiceService.create(workspaceId, session.user.id, parsed.data);
    revalidatePath(`/app/workspace/${workspaceId}/invoices`);
    return ok({ id: invoice.id, number: invoice.number });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create the invoice.");
  }
}

export async function updateInvoiceAction(
  workspaceId: string,
  invoiceId: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = updateInvoiceSchema.safeParse(input);
    if (!parsed.success) return fail("Please fix the highlighted fields.");
    await invoiceService.update(workspaceId, session.user.id, invoiceId, parsed.data);
    revalidatePath(`/app/workspace/${workspaceId}/invoices`);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update the invoice.");
  }
}

export async function sendInvoiceAction(workspaceId: string, invoiceId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await invoiceService.send(workspaceId, session.user.id, invoiceId);
    revalidatePath(`/app/workspace/${workspaceId}/invoices`);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to send the invoice.");
  }
}

export async function markInvoicePaidAction(
  workspaceId: string,
  invoiceId: string,
  paid: boolean
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await invoiceService.markPaid(workspaceId, session.user.id, invoiceId, paid);
    revalidatePath(`/app/workspace/${workspaceId}/invoices`);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update the invoice.");
  }
}

export async function cancelInvoiceAction(workspaceId: string, invoiceId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await invoiceService.cancel(workspaceId, session.user.id, invoiceId);
    revalidatePath(`/app/workspace/${workspaceId}/invoices`);
    return ok(undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to cancel the invoice.");
  }
}
