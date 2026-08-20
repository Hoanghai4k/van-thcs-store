/**
 * Payment Service.
 *
 * Orchestrates the payment flow using a PaymentProvider.
 * Business logic lives here; provider-specific details are delegated.
 *
 * Flow:
 * Checkout → PaymentService.createPayment → PaymentProvider → External Gateway
 *   → Webhook → PaymentService.processWebhook → Verify → handleVerifiedPaymentEvent
 */

import type { PaymentProvider } from "./payment-provider";
import type { PaymentRequest, PaymentResult, VerifiedPaymentEvent, PaymentStatusResult } from "./types";
import { getPaymentProvider } from "./providers";
import { handleVerifiedPaymentEvent, type WebhookProcessingResult } from "./webhook-handler";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Create a payment for an order.
 * Returns checkout URL to redirect customer to.
 */
export async function createPayment(request: PaymentRequest): Promise<PaymentResult> {
  const provider = getPaymentProvider();
  if (!provider) {
    return {
      success: false,
      error: "Payment provider chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
    };
  }

  try {
    return await provider.createPayment(request);
  } catch (error) {
    console.error("[PaymentService] Error creating payment:", error);
    return {
      success: false,
      error: "Không thể khởi tạo thanh toán. Vui lòng thử lại.",
    };
  }
}

/**
 * Process a webhook from a specific provider.
 *
 * 1. Verify webhook signature using provider
 * 2. Process the verified event (update order, etc.)
 */
export async function processWebhook(
  provider: PaymentProvider,
  payload: Record<string, unknown>,
): Promise<{ event: VerifiedPaymentEvent; result: WebhookProcessingResult }> {
  // Step 1: Verify webhook signature
  const event = await provider.verifyWebhook(payload);

  if (!event.valid) {
    return {
      event,
      result: { success: false, action: "rejected", reason: "Invalid signature" },
    };
  }

  // Step 2: Process the verified event
  const supabaseAdmin = getSupabaseAdmin();
  const result = await handleVerifiedPaymentEvent(event, supabaseAdmin);

  return { event, result };
}

/**
 * Query payment status from provider.
 * Used for reconciliation when webhook hasn't arrived.
 */
export async function getPaymentStatus(paymentOrderCode: number): Promise<PaymentStatusResult | null> {
  const provider = getPaymentProvider();
  if (!provider?.getPaymentStatus) {
    return null;
  }

  try {
    return await provider.getPaymentStatus(paymentOrderCode);
  } catch (error) {
    console.error("[PaymentService] Error querying payment status:", error);
    return null;
  }
}

/**
 * Get the current provider name, or null if none configured.
 */
export function getProviderName(): string | null {
  return getPaymentProvider()?.name ?? null;
}
