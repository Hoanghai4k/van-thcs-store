/**
 * Payment Provider Interface.
 *
 * Abstract interface for payment gateway integration.
 * Implementations should be placed in providers/ directory.
 *
 * This design allows swapping payment providers without changing
 * the PaymentService or any business logic.
 */

import type {
  PaymentRequest,
  PaymentResult,
  VerifiedPaymentEvent,
  PaymentStatusResult,
} from "./types";

export interface PaymentProvider {
  /**
   * Provider identifier (e.g., "payos", "momo", "vnpay").
   */
  readonly name: string;

  /**
   * Create a payment and return a checkout URL for the customer.
   */
  createPayment(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Verify a webhook/callback from the payment gateway.
   * Must verify the signature/hash to prevent fraud.
   * Returns a provider-independent VerifiedPaymentEvent.
   */
  verifyWebhook(
    payload: Record<string, unknown>,
  ): Promise<VerifiedPaymentEvent>;

  /**
   * Query the status of an existing payment.
   * Used for reconciliation when webhook is delayed.
   * Optional — not all providers may support this.
   */
  getPaymentStatus?(paymentOrderCode: number): Promise<PaymentStatusResult>;

  /**
   * Cancel a pending payment.
   * Optional — not all providers may support this.
   */
  cancelPayment?(paymentOrderCode: number): Promise<void>;
}
