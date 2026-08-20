/**
 * Generic payment webhook route.
 *
 * DEPRECATED: Use provider-specific webhook routes instead:
 * - payOS: /api/payments/payos/webhook
 *
 * This route is kept for backwards compatibility but delegates
 * to the payOS webhook handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/features/payments/payment-service";
import { getPaymentProvider } from "@/features/payments/providers";

export async function POST(request: NextRequest) {
  try {
    const provider = getPaymentProvider();
    if (!provider) {
      return NextResponse.json({ success: false }, { status: 503 });
    }

    const body = await request.json();
    const { event, result } = await processWebhook(provider, body);

    if (!event.valid) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    return NextResponse.json({ success: true, action: result.action });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { success: false },
      { status: 500 },
    );
  }
}
