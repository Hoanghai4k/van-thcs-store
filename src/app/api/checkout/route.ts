/**
 * Checkout API route.
 *
 * Receives checkout data, validates it, creates an order with
 * server-calculated prices, initiates payment, and returns checkout URL.
 *
 * IMPORTANT: Total amount is ALWAYS calculated server-side.
 * Client-provided prices are NEVER trusted.
 *
 * Duplicate submit protection:
 * Checks for recent PENDING order from same customer with same products.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkoutSchema } from "@/features/orders/schema";
import { createCheckoutOrder, CheckoutError } from "@/features/orders/order-service";
import { createPayment } from "@/features/payments/payment-service";
import type { PaymentItem } from "@/features/payments/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/utils";
import { getSiteUrl } from "@/lib/url";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = checkoutSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error.errors.map((e) => e.message).join(", "),
        },
        { status: 400 },
      );
    }

    const { customerName, customerEmail, customerPhone, productIds } = result.data;

    // Duplicate submit protection: check for recent PENDING order from same email
    const recentOrder = await findRecentPendingOrder(
      normalizeEmail(customerEmail),
      [...new Set(productIds)],
    );
    if (recentOrder) {
      // Return existing order's payment info
      return NextResponse.json({
        success: true,
        data: {
          orderCode: recentOrder.orderCode,
          orderId: recentOrder.orderId,
          totalAmount: recentOrder.totalAmount,
          status: "PENDING",
          checkoutUrl: recentOrder.checkoutUrl,
          message: "Đơn hàng đã được tạo trước đó.",
        },
      });
    }

    // Create order with server-trusted pricing
    const order = await createCheckoutOrder({
      customerName,
      customerEmail,
      customerPhone,
      productIds,
    });

    // Create payment with provider
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
      returnUrl: `${siteUrl}/order/success?orderCode=${order.orderCode}`,
      cancelUrl: `${siteUrl}/order/${order.orderCode}`,
      items: paymentItems,
      expiresInSeconds: 15 * 60, // 15 minutes
    });

    return NextResponse.json({
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
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 },
      );
    }
    console.error("[Checkout API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}

/**
 * Check for a recent PENDING order from the same customer with the same products.
 * Prevents accidental duplicate orders from double-click within 5 minutes.
 */
async function findRecentPendingOrder(
  email: string,
  productIds: string[],
): Promise<{ orderCode: string; orderId: string; totalAmount: number; checkoutUrl?: string } | null> {
  try {
    const supabase = getSupabaseAdmin();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Find recent PENDING orders from this customer
    const { data: orders } = await supabase
      .from("orders")
      .select(`
        id, order_code, total_amount, payment_order_code,
        customer:customers!inner(email),
        items:order_items(product_id)
      `)
      .eq("status", "PENDING")
      .gte("created_at", fiveMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!orders || orders.length === 0) return null;

    // Check if any order matches the same products
    const sortedRequestIds = [...productIds].sort().join(",");

    for (const order of orders) {
      const customer = order.customer as { email: string } | null;
      if (!customer || customer.email.toLowerCase() !== email) continue;

      const orderProductIds = ((order.items as Array<{ product_id: string }>) ?? [])
        .map((i) => i.product_id)
        .sort()
        .join(",");

      if (orderProductIds === sortedRequestIds) {
        return {
          orderCode: order.order_code,
          orderId: order.id,
          totalAmount: order.total_amount,
        };
      }
    }

    return null;
  } catch {
    // Non-critical: if duplicate check fails, just proceed with normal order creation
    return null;
  }
}
