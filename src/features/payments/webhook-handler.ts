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
import type { Database } from "@/types/database";
import type { VerifiedPaymentEvent } from "./types";
import { ORDER_STATUS, type OrderStatus } from "@/lib/constants";
import { canTransition } from "./state-machine";

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

  // 1. Find the order by payment_order_code
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, order_code, total_amount, status, paid_at, payment_transaction_id")
    .eq("payment_order_code", event.providerOrderCode)
    .single();

  if (orderError || !order) {
    // This may be a payOS registration probe (valid signature, unknown orderCode).
    // Return a distinct action so the route handler can acknowledge safely.
    console.log(
      `[Webhook] No matching order for payment_order_code=${event.providerOrderCode} provider=${event.provider ?? "unknown"}`,
    );
    return {
      success: false,
      action: "rejected",
      reason: "unknown_order",
    };
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
  const targetStatus = mapProviderStatus(event.status);
  if (!targetStatus) {
    return {
      success: false,
      action: "rejected",
      orderId: order.id,
      orderCode: order.order_code,
      reason: `Unknown provider status: ${event.status}`,
    };
  }

  // 4. Check idempotency — already in target status
  const currentStatus = order.status as OrderStatus;
  if (currentStatus === targetStatus) {
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

  // 5. Validate state transition
  if (!canTransition(currentStatus, targetStatus)) {
    console.warn(
      `[Webhook] Invalid transition: order=${order.order_code} ${currentStatus} → ${targetStatus}`,
    );
    return {
      success: false,
      action: "rejected",
      orderId: order.id,
      orderCode: order.order_code,
      reason: `Invalid transition: ${currentStatus} → ${targetStatus}`,
    };
  }

  // 6. Update order
  const updateData: {
    status: OrderStatus;
    paid_at?: string;
    payment_transaction_id?: string;
  } = {
    status: targetStatus,
  };

  // Set paid_at only on first PAID transition
  if (targetStatus === ORDER_STATUS.PAID && !order.paid_at) {
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
    `[Webhook] Order updated: order=${order.order_code} ${currentStatus} → ${targetStatus}` +
      (event.providerTransactionId ? ` txn=${event.providerTransactionId}` : ""),
  );

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
function mapProviderStatus(
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
