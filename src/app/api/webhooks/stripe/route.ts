import { NextRequest, NextResponse } from "next/server";
import { billingService } from "@/services/billing.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook receiver. Signature verification lives inside
 * `BillingService.handleWebhook`; unknown-topics are still recorded so
 * billing history is auditable.
 */
export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  const result = await billingService.handleWebhook(payload, signature);
  if (!result.ok) {
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  return NextResponse.json({ received: true, type: result.type });
}