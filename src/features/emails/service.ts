/**
 * Email service.
 *
 * Sends transactional delivery emails using the configured EmailProvider.
 * Handles idempotency, error recovery, and delivery state tracking.
 *
 * SECURITY:
 * - Email delivery failure does NOT affect PAID status
 * - Delivery link points to /delivery/{token} — never contains signed URLs
 * - Idempotency key prevents duplicate emails on webhook retries
 * - API keys are never logged
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getEmailProvider } from "./resend-provider";
import { buildDeliveryEmailSubject, buildDeliveryEmailHtml } from "./templates/delivery-email";
import { buildDeliveryUrl } from "@/features/downloads/token";
import { siteConfig } from "@/config/site";
import { updateDeliveryEmailState } from "@/features/downloads/service";

export interface SendDeliveryEmailInput {
  orderId: string;
  orderCode: string;
  customerEmail: string;
  customerName: string;
  items: Array<{ productName: string; unitPrice: number }>;
  totalAmount: number;
  rawToken: string;
  deliveryGrantId: string;
}

export interface SendDeliveryEmailResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send delivery email for a paid order.
 *
 * Uses Resend idempotency key `delivery-email/{orderId}` to prevent
 * duplicate sends across webhook retries.
 *
 * This function NEVER throws — failures are returned as results.
 * Order PAID status must not depend on email success.
 */
export async function sendDeliveryEmail(
  input: SendDeliveryEmailInput,
  supabaseAdmin: SupabaseClient<Database>,
  options?: { skipIdempotency?: boolean },
): Promise<SendDeliveryEmailResult> {
  const provider = getEmailProvider();

  if (!provider) {
    console.warn("[Email] No email provider configured. Delivery email not sent.");
    return { sent: false, error: "Email provider not configured" };
  }

  const deliveryUrl = buildDeliveryUrl(input.rawToken);
  const subject = buildDeliveryEmailSubject(input.orderCode);
  const html = buildDeliveryEmailHtml({
    customerName: input.customerName,
    orderCode: input.orderCode,
    deliveryUrl,
    expiryDays: siteConfig.store.deliveryTokenExpiryDays,
    items: input.items,
    totalAmount: input.totalAmount,
  });

  // Deterministic idempotency key to prevent duplicate sends
  const idempotencyKey = options?.skipIdempotency
    ? undefined
    : `delivery-email/${input.orderId}`;

  try {
    const result = await provider.sendEmail({
      to: input.customerEmail,
      subject,
      html,
      idempotencyKey,
    });

    if (result.success && result.messageId) {
      // Record delivery email state in database
      await updateDeliveryEmailState(input.deliveryGrantId, result.messageId, supabaseAdmin);

      console.log(
        `[Email] Delivery email sent: order=${input.orderCode} messageId=${result.messageId}`,
      );
    } else {
      console.error(
        `[Email] Delivery email failed: order=${input.orderCode} error=${result.error}`,
      );
    }

    return {
      sent: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Email] Exception sending delivery email: order=${input.orderCode}`, message);
    return { sent: false, error: message };
  }
}
