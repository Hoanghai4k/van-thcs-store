/**
 * payOS Webhook API route.
 *
 * Receives payment callbacks from payOS after customer completes/fails payment.
 *
 * CRITICAL SECURITY:
 * - Verifies webhook signature using official SDK
 * - Validates amount matches order total
 * - Idempotent (same webhook can be received multiple times safely)
 * - Uses service_role DB client (no user session needed)
 * - Never logs API keys or checksum keys
 *
 * PROBE HANDLING:
 * When payOS registers a webhook URL, it may send a signed sample event
 * with an unknown orderCode. This endpoint must:
 * - Verify the signature (reject if invalid)
 * - Acknowledge with 200 if the signature is valid but order is unknown
 * - NOT mutate the database for unknown orders
 *
 * This is a provider-specific endpoint. Other providers (MoMo, VNPAY)
 * would get their own webhook routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/features/payments/payment-service";
import { getPaymentProvider } from "@/features/payments/providers";

export async function POST(request: NextRequest) {
  try {
    const provider = getPaymentProvider();
    if (!provider) {
      console.error("[payOS Webhook] No payment provider configured");
      return NextResponse.json(
        { success: false },
        { status: 503 },
      );
    }

    // Parse the webhook body
    const body = await request.json();

    // Process webhook: verify signature + update order
    const { event, result } = await processWebhook(provider, body);

    // Invalid signature → reject with 400
    if (!event.valid) {
      console.warn("[payOS Webhook] Invalid signature rejected");
      return NextResponse.json({ success: false }, { status: 400 });
    }

    // Valid signature but unknown order (registration probe or stale event)
    // → acknowledge with 200 so payOS doesn't retry, but no DB mutation occurred
    if (result.reason === "unknown_order") {
      console.log("[payOS Webhook] Acknowledged probe/unknown order");
      return NextResponse.json({ success: true, action: "acknowledged" });
    }

    // Processing failed for a known order
    if (!result.success) {
      console.warn(
        `[payOS Webhook] Processing failed: order=${result.orderCode ?? "unknown"} reason=${result.reason}`,
      );
      // Amount mismatch is a serious issue — signal error
      if (result.reason?.startsWith("Amount mismatch")) {
        return NextResponse.json({ success: false, error: "Amount mismatch" }, { status: 400 });
      }
      // Other failures (invalid transition, etc.) — acknowledge to prevent retries
      return NextResponse.json({ success: true, action: result.action });
    }

    // Successfully processed
    console.log(
      `[payOS Webhook] Processed: order=${result.orderCode} action=${result.action}`,
    );

    return NextResponse.json({ success: true, action: result.action });
  } catch (error) {
    console.error("[payOS Webhook] Unexpected error:", error);
    return NextResponse.json(
      { success: false },
      { status: 500 },
    );
  }
}
