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
import type { EmailResult } from "./provider";
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

/**
 * Send a magic link email for My Orders access.
 *
 * Uses an idempotency key based on email hash and a 5-minute time bucket
 * to prevent duplicate sends/abuse.
 */
import { buildMyOrdersEmailSubject, buildMyOrdersEmailHtml } from "./templates/my-orders-email";
import { createHash } from "crypto";

export async function sendMyOrdersAccessEmail(
  email: string,
  magicToken: string,
): Promise<EmailResult> {
  const provider = getEmailProvider();

  if (!provider) {
    console.warn("[Email] No email provider configured. Magic link not sent.");
    return { success: false, error: "Email provider not configured" };
  }

  // Idempotency: hash email so it's not in plaintext, bucket to 5 minutes
  const emailHash = createHash("sha256").update(email).digest("hex").substring(0, 16);
  const timeBucket = Math.floor(Date.now() / (1000 * 60 * 5)); 
  const idempotencyKey = `my-orders-access/${emailHash}/${timeBucket}`;

  const verifyUrl = `${siteConfig.url}/orders/verify?token=${magicToken}`;
  const subject = buildMyOrdersEmailSubject();
  const html = buildMyOrdersEmailHtml({ verifyUrl });

  try {
    const result = await provider.sendEmail({
      to: email,
      subject,
      html,
      idempotencyKey,
    });

    if (result.success) {
      console.log(`[Email] My Orders magic link sent to hashed email ${emailHash}`);
    } else {
      console.error(`[Email] Failed to send My Orders magic link: ${result.error}`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Email] Exception sending magic link`, message);
    return { success: false, error: message };
  }
}
