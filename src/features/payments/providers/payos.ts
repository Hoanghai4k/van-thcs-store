/**
 * payOS Payment Provider.
 *
 * Implements PaymentProvider using the official @payos/node SDK v2.
 * All payOS-specific logic is encapsulated here.
 *
 * SDK: @payos/node v2
 * Docs: https://payos.vn/docs/
 *
 * SECURITY:
 * - Never logs API keys or checksum keys
 * - Webhook signature verification uses SDK built-in method
 * - All secrets stay server-side
 */

import { PayOS } from "@payos/node";
import type { PaymentProvider } from "../payment-provider";
import type {
  PaymentRequest,
  PaymentResult,
  VerifiedPaymentEvent,
  PaymentStatusResult,
} from "../types";
import { ORDER_STATUS } from "@/lib/constants";

export interface PayOSConfig {
  clientId: string;
  apiKey: string;
  checksumKey: string;
}

export class PayOSPaymentProvider implements PaymentProvider {
  readonly name = "payos";
  private readonly payos: InstanceType<typeof PayOS>;

  constructor(config: PayOSConfig) {
    this.payos = new PayOS({
      clientId: config.clientId,
      apiKey: config.apiKey,
      checksumKey: config.checksumKey,
    });
  }

  /**
   * Create a payOS payment link.
   * Maps our PaymentRequest to payOS's expected format.
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const paymentData = {
        orderCode: request.paymentOrderCode,
        amount: request.amount,
        description: request.description.slice(0, 25), // payOS limits description to 25 chars
        cancelUrl: request.cancelUrl,
        returnUrl: request.returnUrl,
        items: request.items.map((item) => ({
          name: item.name.slice(0, 256),
          quantity: item.quantity,
          price: item.price,
        })),
        buyerName: request.customerName,
        buyerEmail: request.customerEmail,
        buyerPhone: request.customerPhone,
        ...(request.expiresInSeconds
          ? { expiredAt: Math.floor(Date.now() / 1000) + request.expiresInSeconds }
          : {}),
      };

      const paymentLink = await this.payos.paymentRequests.create(paymentData);

      console.log(
        `[payOS] Payment link created: orderCode=${request.paymentOrderCode} amount=${request.amount}`,
      );

      return {
        success: true,
        checkoutUrl: (paymentLink as Record<string, unknown>).checkoutUrl as string | undefined,
        qrCode: (paymentLink as Record<string, unknown>).qrCode as string | undefined,
        paymentLinkId: (paymentLink as Record<string, unknown>).paymentLinkId as string | undefined,
      };
    } catch (error) {
      console.error(
        `[payOS] Failed to create payment: orderCode=${request.paymentOrderCode}`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return {
        success: false,
        error: "Không thể khởi tạo thanh toán. Vui lòng thử lại.",
      };
    }
  }

  /**
   * Verify payOS webhook signature and parse payment event.
   * Uses the SDK's built-in verification which checks the checksum.
   */
  async verifyWebhook(
    payload: Record<string, unknown>,
  ): Promise<VerifiedPaymentEvent> {
    try {
      // SDK verifies signature and returns verified data
      // Throws if signature is invalid
      // payload comes from the HTTP request body and matches payOS webhook format
      const webhookData = await this.payos.webhooks.verify(
        payload as unknown as Parameters<typeof this.payos.webhooks.verify>[0],
      ) as unknown as Record<string, unknown>;

      // Map payOS status code to our status
      // payOS codes: "00" = success, others = failure
      const providerCode = String(webhookData.code ?? "");
      let status: VerifiedPaymentEvent["status"];

      if (providerCode === "00") {
        status = "success";
      } else if (providerCode === "01") {
        // Payment cancelled by user or expired
        status = "cancelled";
      } else {
        status = "failed";
      }

      return {
        valid: true,
        provider: this.name,
        providerOrderCode: webhookData.orderCode as number | undefined,
        providerTransactionId: (webhookData.reference ?? webhookData.paymentLinkId ?? undefined) as string | undefined,
        amount: webhookData.amount as number | undefined,
        status,
        providerStatusCode: providerCode,
      };
    } catch (error) {
      console.warn(
        "[payOS] Webhook verification failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
      return { valid: false };
    }
  }

  /**
   * Query payment status from payOS.
   * Used for reconciliation when webhook hasn't arrived yet.
   */
  async getPaymentStatus(paymentOrderCode: number): Promise<PaymentStatusResult> {
    try {
      const info = await this.payos.paymentRequests.get(paymentOrderCode) as Record<string, unknown>;

      if (!info) {
        return { found: false };
      }

      // Map payOS status to our OrderStatus
      let status;
      const payosStatus = String(info.status ?? "").toUpperCase();
      if (payosStatus === "PAID") {
        status = ORDER_STATUS.PAID;
      } else if (payosStatus === "CANCELLED" || payosStatus === "EXPIRED") {
        status = ORDER_STATUS.CANCELLED;
      } else if (payosStatus === "PENDING") {
        status = ORDER_STATUS.PENDING;
      } else {
        status = ORDER_STATUS.FAILED;
      }

      return {
        found: true,
        status,
        amount: info.amount as number | undefined,
        providerTransactionId: info.id as string | undefined,
      };
    } catch (error) {
      console.error(
        `[payOS] Failed to query status: orderCode=${paymentOrderCode}`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return { found: false };
    }
  }

  /**
   * Cancel a pending payment link.
   */
  async cancelPayment(paymentOrderCode: number): Promise<void> {
    try {
      await this.payos.paymentRequests.cancel(paymentOrderCode);
      console.log(`[payOS] Payment cancelled: orderCode=${paymentOrderCode}`);
    } catch (error) {
      console.error(
        `[payOS] Failed to cancel payment: orderCode=${paymentOrderCode}`,
        error instanceof Error ? error.message : "Unknown error",
      );
      throw new Error("Không thể hủy thanh toán.");
    }
  }
}
