/**
 * Resume payment API route.
 *
 * For PENDING orders, queries the existing active payment attempt.
 * If expired/cancelled, creates a new payment_attempts row and payOS link.
 *
 * CRITICAL: This route NEVER marks an order as PAID.
 * It only creates/retrieves a checkout URL for the customer.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createPayment, getPaymentStatus, getProviderName } from "@/features/payments/payment-service";
import type { PaymentItem } from "@/features/payments/types";
import { getSiteUrl } from "@/lib/url";
import { getOrderAccessCookie } from "@/lib/auth/order-access";
import { generateUniquePaymentOrderCode } from "@/features/orders/order-service";
import { PAYMENT_ATTEMPT_STATUS } from "@/lib/constants";

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

    // 1. Authorize via order access cookie
    const authResult = await getOrderAccessCookie(orderCode);
    if (!authResult.valid) {
      return NextResponse.json(
        { success: false, error: "Không có quyền truy cập đơn hàng này." },
        { status: 403 },
      );
    }

    const providerName = getProviderName();
    if (!providerName) {
      return NextResponse.json(
        { success: false, error: "Hệ thống thanh toán chưa được cấu hình." },
        { status: 503 },
      );
    }

    const supabase = getSupabaseAdmin();

    // 2. Fetch the order with items and customer
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id, order_code, total_amount, status, payment_method,
        customer:customers!inner(name, email, phone),
        items:order_items(product_name, unit_price)
      `)
      .eq("id", authResult.orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy đơn hàng." },
        { status: 404 },
      );
    }

    // 3. Only allow resuming PENDING orders
    if (order.status !== "PENDING") {
      return NextResponse.json({
        success: false,
        error:
          order.status === "PAID"
            ? "Đơn hàng đã được thanh toán."
            : "Đơn hàng không thể thanh toán.",
      }, { status: 400 });
    }

    const customer = order.customer as { name: string; email: string; phone: string | null };
    const items = (order.items as Array<{ product_name: string; unit_price: number }>) ?? [];

    // 4. Concurrency & active attempt check
    // We lock this block conceptually by checking for an active attempt.
    const { data: activeAttempt } = await supabase
      .from("payment_attempts")
      .select("id, provider_order_code, expires_at, checkout_url, status")
      .eq("order_id", order.id)
      .eq("provider", providerName)
      .in("status", [PAYMENT_ATTEMPT_STATUS.PENDING, PAYMENT_ATTEMPT_STATUS.PROCESSING])
      .maybeSingle();

    if (activeAttempt) {
      // Reconcile with provider to check if it's still active
      const existingStatus = await getPaymentStatus(activeAttempt.provider_order_code);
      const isExpiredByTime = activeAttempt.expires_at && new Date(activeAttempt.expires_at).getTime() <= Date.now();

      if (existingStatus?.status === PAYMENT_ATTEMPT_STATUS.CANCELLED || existingStatus?.status === PAYMENT_ATTEMPT_STATUS.EXPIRED || isExpiredByTime) {
        // Mark as EXPIRED/CANCELLED
        const newStatus = existingStatus?.status === PAYMENT_ATTEMPT_STATUS.CANCELLED ? PAYMENT_ATTEMPT_STATUS.CANCELLED : PAYMENT_ATTEMPT_STATUS.EXPIRED;
        await supabase
          .from("payment_attempts")
          .update({
            status: newStatus,
            ...(newStatus === PAYMENT_ATTEMPT_STATUS.CANCELLED ? { cancelled_at: new Date().toISOString() } : {})
          })
          .eq("id", activeAttempt.id);
        
        // We marked it inactive, so we will create a new one below.
      } else {
        // Still active and valid, return existing checkoutUrl
        if (activeAttempt.checkout_url) {
          return NextResponse.json({
            success: true,
            data: { checkoutUrl: activeAttempt.checkout_url },
          });
        }
        // If no checkoutUrl but active, we might need to recreate. Fall through.
      }
    }

    // 5. Create new payment attempt
    const newPaymentOrderCode = await generateUniquePaymentOrderCode(supabase);
    const siteUrl = getSiteUrl();
    const paymentItems: PaymentItem[] = items.map((item) => ({
      name: item.product_name,
      quantity: 1,
      price: item.unit_price,
    }));
    const expiresInSeconds = 15 * 60;

    // Create via provider first
    const paymentResult = await createPayment({
      orderId: order.id,
      orderCode: order.order_code,
      paymentOrderCode: newPaymentOrderCode,
      amount: order.total_amount,
      description: `VTS ${order.order_code}`,
      customerEmail: customer.email,
      customerName: customer.name,
      customerPhone: customer.phone ?? "",
      returnUrl: `${siteUrl}/order/${order.order_code}`,
      cancelUrl: `${siteUrl}/order/${order.order_code}`,
      items: paymentItems,
      expiresInSeconds,
    });

    if (!paymentResult.success || !paymentResult.checkoutUrl) {
      return NextResponse.json({
        success: false,
        error: paymentResult.error || "Không thể tạo link thanh toán.",
      }, { status: 500 });
    }

    // Save to payment_attempts
    const { error: insertError } = await supabase
      .from("payment_attempts")
      .insert({
        order_id: order.id,
        provider: providerName,
        provider_order_code: newPaymentOrderCode,
        amount: order.total_amount,
        status: PAYMENT_ATTEMPT_STATUS.PENDING,
        checkout_url: paymentResult.checkoutUrl,
        provider_payment_link_id: paymentResult.paymentLinkId || null,
        expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      });

    if (insertError) {
      console.error("[Resume Payment] Insert attempt error:", insertError);
      // Even if it fails to save, we could arguably return the checkoutUrl, but better to fail securely.
      return NextResponse.json({
        success: false,
        error: "Lỗi lưu thông tin thanh toán. Vui lòng thử lại.",
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
