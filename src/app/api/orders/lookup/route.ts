/**
 * Order lookup API route.
 *
 * Allows customers to check their order status using order code + email.
 * Both must match for security (prevents enumeration attacks).
 */

import { NextRequest, NextResponse } from "next/server";
import { orderLookupSchema } from "@/features/orders/schema";
import { lookupOrder } from "@/features/orders/queries";

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
      return NextResponse.json(
        { success: false, error: "Không tìm thấy đơn hàng với thông tin đã nhập." },
        { status: 404 },
      );
    }

    // Return safe order info (no file paths, no internal IDs)
    return NextResponse.json({
      success: true,
      data: {
        orderCode: order.orderCode,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        items: order.items.map((item) => ({
          productName: item.productName,
          unitPrice: item.unitPrice,
        })),
      },
    });
  } catch (error) {
    console.error("[Order Lookup] Error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống" },
      { status: 500 },
    );
  }
}
