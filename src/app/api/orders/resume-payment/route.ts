/**
 * Resume payment API route.
 *
 * For PENDING orders, queries the existing payOS payment status
 * and creates a new payment link if the old one expired.
 *
 * CRITICAL: This route NEVER marks an order as PAID.
 * It only creates/retrieves a checkout URL for the customer.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createPayment, getPaymentStatus } from "@/features/payments/payment-service";
import { getPaymentProvider } from "@/features/payments/providers";
import type { PaymentItem } from "@/features/payments/types";
import { getSiteUrl } from "@/lib/url";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const orderCode = body.orderCode as string | undefined;

    if (!orderCode || typeof orderCode !== "string") {
      return NextResponse.json(
        { success: false, error: "Mã đơn hàng không hợp lệ." },
        { status: 400 },
      );
    }

    const provider = getPaymentProvider();
    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Hệ thống thanh toán chưa được cấu hình." },
        { status: 503 },
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the order with items and customer
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id, order_code, total_amount, payment_order_code, status, payment_method,
        customer:customers!inner(name, email, phone),
        items:order_items(product_name, unit_price)
      `)
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy đơn hàng." },
        { status: 404 },
      );
    }

    // Only allow resuming PENDING orders
    if (order.status !== "PENDING") {
      return NextResponse.json({
        success: false,
        error:
          order.status === "PAID"
            ? "Đơn hàng đã được thanh toán."
            : "Đơn hàng không thể thanh toán.",
      }, { status: 400 });
    }

    if (!order.payment_order_code) {
      return NextResponse.json(
        { success: false, error: "Đơn hàng thiếu mã thanh toán." },
        { status: 400 },
      );
    }

    const customer = order.customer as { name: string; email: string; phone: string | null };
    const items = (order.items as Array<{ product_name: string; unit_price: number }>) ?? [];

    // Try querying existing payOS payment status first
    const existingStatus = await getPaymentStatus(order.payment_order_code);

    // If the existing payment link is still PENDING at payOS, try to reuse it
    // by redirecting to the same checkout URL. But payOS doesn't return the
    // checkout URL from getPaymentStatus, so we always create a new payment link.
    // payOS will handle deduplication on their end if the orderCode is the same.

    // If the existing payOS link was cancelled/expired, we need to cancel it
    // and update our payment_order_code to create a fresh one
    if (existingStatus?.found && existingStatus.status !== "PENDING") {
      // The payOS link is no longer valid — this shouldn't happen for a
      // PENDING order (webhook would have changed our status). But handle gracefully.
      return NextResponse.json({
        success: false,
        error: "Link thanh toán đã hết hạn. Vui lòng tạo đơn hàng mới.",
      }, { status: 400 });
    }

    // Create a (possibly new) payment link using the same payment_order_code
    const siteUrl = getSiteUrl();
    const paymentItems: PaymentItem[] = items.map((item) => ({
      name: item.product_name,
      quantity: 1,
      price: item.unit_price,
    }));

    const paymentResult = await createPayment({
      orderId: order.id,
      orderCode: order.order_code,
      paymentOrderCode: order.payment_order_code,
      amount: order.total_amount,
      description: `VTS ${order.order_code}`,
      customerEmail: customer.email,
      customerName: customer.name,
      customerPhone: customer.phone ?? "",
      returnUrl: `${siteUrl}/order/success?orderCode=${order.order_code}`,
      cancelUrl: `${siteUrl}/order/${order.order_code}`,
      items: paymentItems,
      expiresInSeconds: 15 * 60,
    });

    if (!paymentResult.success || !paymentResult.checkoutUrl) {
      return NextResponse.json({
        success: false,
        error: paymentResult.error || "Không thể tạo link thanh toán.",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { checkoutUrl: paymentResult.checkoutUrl },
    });
  } catch (error) {
    console.error("[Resume Payment] Error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
