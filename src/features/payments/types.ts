/**
 * Payment types.
 *
 * Provider-agnostic types used by PaymentService and PaymentProvider.
 * Provider-specific details are encapsulated inside each provider implementation.
 */

import type { OrderStatus } from "@/lib/constants";

// ─── Payment Request ──────────────────────────────────────────────

/** Input for creating a payment with a provider */
export interface PaymentRequest {
  /** Internal order UUID */
  orderId: string;
  /** Human-friendly order code (e.g., VTS-20260819-ABC12) */
  orderCode: string;
  /** Numeric payment order code for providers that require it (e.g., payOS) */
  paymentOrderCode: number;
  /** Total amount in VND (integer, server-calculated) */
  amount: number;
  /** Payment description (shown to customer) */
  description: string;
  /** Customer info */
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  /** Callback URLs */
  returnUrl: string;
  cancelUrl: string;
  /** Line items for provider display */
  items: PaymentItem[];
  /** Payment link expiry in seconds from now (optional) */
  expiresInSeconds?: number;
}

/** Line item sent to payment provider */
export interface PaymentItem {
  name: string;
  quantity: number;
  price: number;
}

// ─── Payment Result ───────────────────────────────────────────────

/** Result of creating a payment */
export interface PaymentResult {
  success: boolean;
  /** URL to redirect customer to hosted checkout */
  checkoutUrl?: string;
  /** QR code data URL if provider supports it */
  qrCode?: string;
  /** Provider-specific payment link ID */
  paymentLinkId?: string;
  /** Error message (Vietnamese, customer-safe) */
  error?: string;
}

// ─── Webhook / Payment Event ──────────────────────────────────────

/** Verified payment event from provider webhook */
export interface VerifiedPaymentEvent {
  /** Whether the webhook signature was valid */
  valid: boolean;
  /** Provider name (e.g., "payos") */
  provider?: string;
  /** The numeric order code sent to the provider */
  providerOrderCode?: number;
  /** Provider's transaction/reference ID */
  providerTransactionId?: string;
  /** Amount confirmed by provider */
  amount?: number;
  /** Mapped payment status */
  status?: "success" | "failed" | "cancelled";
  /** Raw provider status code (for logging) */
  providerStatusCode?: string;
}

// ─── Payment Status ───────────────────────────────────────────────

/** Result of querying payment status from provider */
export interface PaymentStatusResult {
  /** Whether the query succeeded */
  found: boolean;
  /** Current payment status */
  status?: OrderStatus;
  /** Amount */
  amount?: number;
  /** Provider transaction ID */
  providerTransactionId?: string;
  /** When the payment was made */
  paidAt?: string;
}
