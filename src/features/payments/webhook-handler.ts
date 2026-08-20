/**
 * Webhook handler — provider-independent payment event processing.
 *
 * This module contains the core business logic for processing
 * verified payment events. It is deliberately separated from
 * HTTP/provider concerns so it can be unit-tested independently.
 *
 * Flow:
 *   HTTP webhook route → provider.verifyWebhook() → handleVerifiedPaymentEvent()
 *
 * SECURITY:
 * - Only processes events that have passed provider signature verification
 * - Validates amount matches order total
 * - Idempotent: duplicate events are safe
 * - Uses state machine to enforce valid transitions
 * - Never logs secrets
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DbOrderUpdate, DbPaymentAttemptUpdate } from "@/types/database";
import type { Database } from "@/types/database";
import type { VerifiedPaymentEvent } from "./types";
import { ORDER_STATUS, PAYMENT_ATTEMPT_STATUS, type OrderStatus, type PaymentAttemptStatus } from "@/lib/constants";
import { canTransition } from "./state-machine";
import { ensureDeliveryGrant } from "@/features/downloads/service";
import { sendDeliveryEmail } from "@/features/emails/service";

export interface WebhookProcessingResult {
  success: boolean;
  action: "updated" | "already_processed" | "rejected";
  orderId?: string;
  orderCode?: string;
  reason?: string;
}

/**
 * Process a verified payment event from any provider.
 * This is the core idempotent webhook handler.
 *
 * @param event - Verified event from provider (signature already checked)
 * @param supabaseAdmin - Service-role Supabase client for DB mutations
 */
export async function handleVerifiedPaymentEvent(
  event: VerifiedPaymentEvent,
  supabaseAdmin: SupabaseClient<Database>,
): Promise<WebhookProcessingResult> {
  if (!event.valid) {
    return { success: false, action: "rejected", reason: "Invalid event" };
  }

  if (!event.providerOrderCode) {
    return { success: false, action: "rejected", reason: "Missing provider order code" };
  }

  const providerName = event.provider ?? "payos";

  // 1. Find the order by payment_order_code (check payment_attempts first, then legacy fallback)
  let orderId: string | null = null;
  let attemptId: string | null = null;

  const { data: attempt } = await supabaseAdmin
    .from("payment_attempts")
    .select("id, order_id, status")
    .eq("provider_order_code", event.providerOrderCode)
    .eq("provider", providerName)
    .maybeSingle();

  if (attempt) {
    orderId = attempt.order_id;
    attemptId = attempt.id;
  } else {
    // Legacy fallback
    const { data: legacyOrder } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("payment_order_code", event.providerOrderCode)
      .maybeSingle();
      
    if (legacyOrder) {
      orderId = legacyOrder.id;
    }
  }

  if (!orderId) {
    // This may be a payOS registration probe (valid signature, unknown orderCode).
    // Return a distinct action so the route handler can acknowledge safely.
    console.log(
      `[Webhook] No matching order for payment_order_code=${event.providerOrderCode} provider=${providerName}`,
    );
    return {
      success: false,
      action: "rejected",
      reason: "unknown_order",
    };
  }
  
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, order_code, total_amount, status, paid_at, payment_transaction_id")
    .eq("id", orderId)
    .single();
    
  if (orderError || !order) {
    return { success: false, action: "rejected", reason: "Order fetch failed" };
  }

  // 2. Amount validation
  if (event.amount !== undefined && event.amount !== order.total_amount) {
    console.error(
      `[Webhook] AMOUNT MISMATCH: order=${order.order_code} expected=${order.total_amount} received=${event.amount}`,
    );
    return {
      success: false,
      action: "rejected",
      orderId: order.id,
      orderCode: order.order_code,
      reason: `Amount mismatch: expected ${order.total_amount}, received ${event.amount}`,
    };
  }

  // 3. Map provider status to order status
  const targetOrderStatus = mapProviderStatusToOrder(event.status);
  const targetAttemptStatus = mapProviderStatusToAttempt(event.status);
  
  if (!targetOrderStatus || !targetAttemptStatus) {
    return {
      success: false,
      action: "rejected",
      orderId: order.id,
      orderCode: order.order_code,
      reason: `Unknown provider status: ${event.status}`,
    };
  }
  
  // 4. Update payment attempt if it exists
  if (attemptId && attempt?.status !== targetAttemptStatus) {
     const attemptUpdateData: DbPaymentAttemptUpdate = { status: targetAttemptStatus };
     if (targetAttemptStatus === PAYMENT_ATTEMPT_STATUS.PAID) attemptUpdateData.paid_at = new Date().toISOString();
     if (targetAttemptStatus === PAYMENT_ATTEMPT_STATUS.CANCELLED) attemptUpdateData.cancelled_at = new Date().toISOString();
     if (event.providerTransactionId) attemptUpdateData.provider_payment_link_id = event.providerTransactionId;
     
     await supabaseAdmin
       .from("payment_attempts")
       .update(attemptUpdateData)
       .eq("id", attemptId);
  }

  // 5. Check order idempotency — already in target status
  const currentStatus = order.status as OrderStatus;
  if (currentStatus === targetOrderStatus) {
    console.log(
      `[Webhook] Already processed: order=${order.order_code} status=${currentStatus}`,
    );
    return {
      success: true,
      action: "already_processed",
      orderId: order.id,
      orderCode: order.order_code,
    };
  }
  
  // Never regress a PAID order
  if (currentStatus === ORDER_STATUS.PAID) {
    console.warn(`[Webhook] Order already PAID. Ignoring transition to ${targetOrderStatus} for order=${order.order_code}`);
    return {
      success: true, // Acknowledge safely
      action: "already_processed",
      orderId: order.id,
      orderCode: order.order_code,
    };
  }

  // 6. Validate state transition
  if (!canTransition(currentStatus, targetOrderStatus)) {
    console.warn(
      `[Webhook] Invalid transition: order=${order.order_code} ${currentStatus} → ${targetOrderStatus}`,
    );
    return {
      success: false,
      action: "rejected",
      orderId: order.id,
      orderCode: order.order_code,
      reason: `Invalid transition: ${currentStatus} → ${targetOrderStatus}`,
    };
  }

  // 7. Update order
  const updateData: {
    status: OrderStatus;
    paid_at?: string;
    payment_transaction_id?: string;
  } = {
    status: targetOrderStatus,
  };

  // Set paid_at only on first PAID transition
  if (targetOrderStatus === ORDER_STATUS.PAID && !order.paid_at) {
    updateData.paid_at = new Date().toISOString();
  }

  // Set transaction ID if not already set
  if (event.providerTransactionId && !order.payment_transaction_id) {
    updateData.payment_transaction_id = event.providerTransactionId;
  }

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update(updateData)
    .eq("id", order.id)
    .eq("status", currentStatus); // Optimistic concurrency: only update if status hasn't changed

  if (updateError) {
    console.error(
      `[Webhook] Failed to update order=${order.order_code}:`,
      updateError.message,
    );
    return {
      success: false,
      action: "rejected",
      orderId: order.id,
      orderCode: order.order_code,
      reason: "Database update failed",
    };
  }

  console.log(
    `[Webhook] Order updated: order=${order.order_code} ${currentStatus} → ${targetOrderStatus}` +
      (event.providerTransactionId ? ` txn=${event.providerTransactionId}` : ""),
  );

  // ─── Post-PAID side effects (delivery grant + email) ─────────
  // Only on first PAID transition. Email failure does NOT undo PAID.
  if (targetOrderStatus === ORDER_STATUS.PAID) {
    try {
      await handlePaidDelivery(order.id, order.order_code, supabaseAdmin);
    } catch (deliveryError) {
      // Log but do NOT fail the webhook response
      console.error(
        `[Webhook] Delivery side-effect error for order=${order.order_code}:`,
        deliveryError instanceof Error ? deliveryError.message : deliveryError,
      );
    }
  }

  return {
    success: true,
    action: "updated",
    orderId: order.id,
    orderCode: order.order_code,
  };
}

/**
 * Map provider payment status to our OrderStatus.
 */
function mapProviderStatusToOrder(
  status: VerifiedPaymentEvent["status"],
): OrderStatus | null {
  switch (status) {
    case "success":
      return ORDER_STATUS.PAID;
    case "failed":
      return ORDER_STATUS.FAILED;
    case "cancelled":
      return ORDER_STATUS.CANCELLED;
    default:
      return null;
  }
}

/**
 * Map provider payment status to our PaymentAttemptStatus.
 */
function mapProviderStatusToAttempt(
  status: VerifiedPaymentEvent["status"],
): PaymentAttemptStatus | null {
  switch (status) {
    case "success":
      return PAYMENT_ATTEMPT_STATUS.PAID;
    case "failed":
      return PAYMENT_ATTEMPT_STATUS.FAILED;
    case "cancelled":
      return PAYMENT_ATTEMPT_STATUS.CANCELLED;
    default:
      return null;
  }
}

/**
 * Handle post-PAID delivery side effects:
 * 1. Create/ensure delivery grant (hash-only token)
 * 2. Send delivery email with secure link
 *
 * This function NEVER throws to the caller in a way that should
 * affect the PAID status. All errors are caught and logged.
 */
async function handlePaidDelivery(
  orderId: string,
  orderCode: string,
  supabaseAdmin: SupabaseClient<Database>,
): Promise<void> {
  // 1. Ensure delivery grant exists
  const { grant, rawToken, isNew } = await ensureDeliveryGrant(orderId, supabaseAdmin);

  // If grant already existed and email was already sent, skip
  if (!isNew && grant.deliveryEmailSentAt) {
    console.log(`[Webhook] Delivery grant already exists with email sent for order=${orderCode}`);
    return;
  }

  // If no raw token (grant existed but no email sent), we need to create a new one for the email
  if (!rawToken) {
    console.log(`[Webhook] Delivery grant exists but no raw token available for email: order=${orderCode}`);
    return;
  }

  // 2. Fetch order details for email
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("customer_id, total_amount")
    .eq("id", orderId)
    .single();

  if (!order) return;

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("name, email")
    .eq("id", order.customer_id)
    .single();

  if (!customer) return;

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("product_name, unit_price")
    .eq("order_id", orderId);

  if (!items || items.length === 0) return;

  // 3. Send delivery email (idempotent via Resend key)
  await sendDeliveryEmail(
    {
      orderId,
      orderCode,
      customerEmail: customer.email,
      customerName: customer.name,
      items: items.map((i) => ({ productName: i.product_name, unitPrice: i.unit_price })),
      totalAmount: order.total_amount,
      rawToken,
      deliveryGrantId: grant.id,
    },
    supabaseAdmin,
  );
}

