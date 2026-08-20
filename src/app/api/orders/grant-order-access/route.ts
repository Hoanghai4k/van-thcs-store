import { NextRequest, NextResponse } from "next/server";
import { getMyOrdersAccessCookie } from "@/lib/auth/my-orders-access";
import { getOrdersByEmail } from "@/features/orders/queries";
import { setOrderAccessCookie } from "@/lib/auth/order-access";
import { z } from "zod";

const grantAccessSchema = z.object({
  orderCode: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Verify My Orders Access Session
    const session = await getMyOrdersAccessCookie();
    if (!session.valid) {
      return NextResponse.json(
        { success: false, error: "Phiên đăng nhập đã hết hạn" },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const result = grantAccessSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const { orderCode } = result.data;

    // 3. Verify order ownership
    // Instead of querying by ID, we query all owned orders and find the matching one.
    // This is safe since getOrdersByEmail is already scoped to the normalized email.
    const ownedOrders = await getOrdersByEmail(session.email);
    const targetOrder = ownedOrders.find((o) => o.orderCode === orderCode);

    if (!targetOrder) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy đơn hàng hoặc không có quyền truy cập" },
        { status: 403 }
      );
    }

    // 4. Grant Order Access
    const response = NextResponse.json({
      success: true,
      data: {
        redirectUrl: `/order/${targetOrder.orderCode}`,
      },
    });

    setOrderAccessCookie(response, targetOrder.id, targetOrder.orderCode);

    return response;
  } catch (error) {
    console.error("[Grant Order Access] Error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}
