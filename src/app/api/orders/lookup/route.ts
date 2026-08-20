/**
 * Order lookup API route.
 *
 * Allows customers to verify ownership of an order using order code + email.
 * On success, issues a signed HttpOnly order-access cookie and returns
 * the order code for client-side redirect to /order/{orderCode}.
 *
 * SECURITY:
 * - Both order code and email must match for access
 * - Wrong email returns a generic error (no enumeration)
 * - Cookie is HttpOnly, Secure, SameSite=Lax
 * - Cookie authorizes VIEWING only, not downloads or mutations
 */

import { NextRequest, NextResponse } from "next/server";
import { orderLookupSchema } from "@/features/orders/schema";
import { lookupOrder } from "@/features/orders/queries";
import { setOrderAccessCookie } from "@/lib/auth/order-access";

const GENERIC_NOT_FOUND = "Không tìm thấy đơn hàng với thông tin đã cung cấp.";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderCode = searchParams.get("orderCode") ?? "";
    const email = searchParams.get("email") ?? "";

    const result = orderLookupSchema.safeParse({ orderCode, email });
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Thông tin tra cứu không hợp lệ" },
        { status: 400 },
      );
    }

    const order = await lookupOrder(result.data.orderCode, result.data.email);

    if (!order) {
      // Generic error — do not reveal whether order code or email is wrong
      return NextResponse.json(
        { success: false, error: GENERIC_NOT_FOUND },
        { status: 404 },
      );
    }

    // Issue order-access cookie and return orderCode for redirect
    const res = NextResponse.json({
      success: true,
      data: {
        orderCode: order.orderCode,
      },
    });
    setOrderAccessCookie(res, order.id, order.orderCode);
    return res;
  } catch (error) {
    console.error("[Order Lookup] Error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống" },
      { status: 500 },
    );
  }
}
