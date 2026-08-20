/**
 * Delivery grant API route.
 *
 * POST /api/delivery/grant
 *
 * Creates or ensures a delivery grant for a PAID order,
 * sets the delivery access cookie, and returns success.
 *
 * Called from the order page "Nhận tài liệu" button.
 *
 * SECURITY:
 * - Requires valid order-access cookie (customer verified their email)
 * - Only PAID orders can receive delivery grants
 * - Does NOT expose raw delivery tokens to the client
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getOrderAccessCookie } from "@/lib/auth/order-access";
import { ensureDeliveryGrant } from "@/features/downloads/service";
import { setDeliveryAccessCookie } from "@/lib/auth/delivery-access";
import { ORDER_STATUS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, orderCode } = body;

    if (!orderId || !orderCode) {
      return NextResponse.json(
        { success: false, error: "Thông tin không hợp lệ." },
        { status: 400 },
      );
    }

    // 1. Verify order-access cookie (customer must have verified email)
    const orderAccess = await getOrderAccessCookie(orderCode);
    if (!orderAccess.valid) {
      return NextResponse.json(
        { success: false, error: "Phiên truy cập đơn hàng không hợp lệ." },
        { status: 403 },
      );
    }

    // 2. Verify order exists and is PAID
    const supabaseAdmin = getSupabaseAdmin();
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .eq("order_code", orderCode)
      .single();

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Đơn hàng không tồn tại." },
        { status: 404 },
      );
    }

    if (order.status !== ORDER_STATUS.PAID) {
      return NextResponse.json(
        { success: false, error: "Đơn hàng chưa đủ điều kiện tải tài liệu." },
        { status: 403 },
      );
    }

    // 3. Ensure delivery grant exists
    const { grant } = await ensureDeliveryGrant(orderId, supabaseAdmin);

    // 4. Set delivery access cookie on response
    const response = NextResponse.json({ success: true });
    setDeliveryAccessCookie(response, grant.id, orderId);

    return response;
  } catch (error) {
    console.error("[DeliveryGrant] Error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
