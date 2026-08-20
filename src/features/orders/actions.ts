/**
 * Order server actions.
 *
 * CRITICAL: Total amount is ALWAYS calculated server-side from the database.
 * The client only sends product IDs, never prices.
 */

"use server";

import { checkoutSchema } from "./schema";
import { createCheckoutOrder, CheckoutError } from "./order-service";
import { createPayment } from "@/features/payments/payment-service";
import type { PaymentItem } from "@/features/payments/types";
import type { ApiResponse } from "@/types/common";
import { getSiteUrl } from "@/lib/url";
import { setOrderAccessCookieFromServer } from "@/lib/auth/order-access";

interface CheckoutResult {
  orderCode: string;
  orderId: string;
  totalAmount: number;
  status: string;
  checkoutUrl?: string;
  qrCode?: string;
  items: Array<{
    productName: string;
    unitPrice: number;
  }>;
}

/**
 * Create a new order and initiate payment.
 *
 * Flow:
 * 1. Validate input (customer info + product IDs)
 * 2. Create order with server-trusted pricing
 * 3. Create payment with provider
 * 4. Return order summary + payment URL
 */
export async function createOrderAndPayment(
  formData: unknown,
): Promise<ApiResponse<CheckoutResult>> {
  try {
    // 1. Validate input
    const result = checkoutSchema.safeParse(formData);
    if (!result.success) {
      return {
        success: false,
        error: result.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { customerName, customerEmail, customerPhone, productIds } =
      result.data;

    // 2. Create order (server-trusted pricing)
    const order = await createCheckoutOrder({
      customerName,
      customerEmail,
      customerPhone,
      productIds,
    });

    // 3. Create payment with provider
    const siteUrl = getSiteUrl();
    const paymentItems: PaymentItem[] = order.items.map((item) => ({
      name: item.productName,
      quantity: 1,
      price: item.unitPrice,
    }));

    const paymentResult = await createPayment({
      orderId: order.orderId,
      orderCode: order.orderCode,
      paymentOrderCode: order.paymentOrderCode,
      amount: order.totalAmount,
      description: `VTS ${order.orderCode}`,
      customerEmail,
      customerName,
      customerPhone,
      returnUrl: `${siteUrl}/order/${order.orderCode}`,
      cancelUrl: `${siteUrl}/order/${order.orderCode}`,
      items: paymentItems,
      expiresInSeconds: 15 * 60, // 15 minutes
    });

    // 4. Issue order-access cookie for this browser
    await setOrderAccessCookieFromServer(order.orderId, order.orderCode);

    // 5. Return result
    return {
      success: true,
      data: {
        orderCode: order.orderCode,
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        status: "PENDING",
        checkoutUrl: paymentResult.success ? paymentResult.checkoutUrl : undefined,
        qrCode: paymentResult.success ? paymentResult.qrCode : undefined,
        items: order.items.map((item) => ({
          productName: item.productName,
          unitPrice: item.unitPrice,
        })),
      },
    };
  } catch (error) {
    if (error instanceof CheckoutError) {
      return { success: false, error: error.message };
    }
    console.error("[Order] Error creating order:", error);
    return {
      success: false,
      error: "Đã xảy ra lỗi khi tạo đơn hàng. Vui lòng thử lại.",
    };
  }
}
