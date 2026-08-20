import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/utils";
import { hasOrdersForEmail } from "@/features/orders/queries";
import { generateMagicLinkToken } from "@/lib/auth/my-orders-access";
import { sendMyOrdersAccessEmail } from "@/features/emails/service";

const requestAccessSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

const GENERIC_RESPONSE = "Nếu email này có đơn hàng, chúng tôi đã gửi liên kết xác minh.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = requestAccessSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(result.data.email);
    
    // We do NOT block on email sending to avoid timing attacks
    // that could reveal if the email exists in the system.
    
    // However, since we need to check DB and send email, we can't completely
    // eliminate timing differences unless we deliberately delay the false case,
    // but a generic response is sufficient for V1.
    const hasOrders = await hasOrdersForEmail(email);

    if (hasOrders) {
      const magicToken = generateMagicLinkToken(email);
      // Fire and forget email sending to avoid blocking the response
      sendMyOrdersAccessEmail(email, magicToken).catch((err) => {
        console.error("[MyOrders] Failed to send magic link:", err);
      });
    }

    // Always return the same response
    return NextResponse.json({
      success: true,
      message: GENERIC_RESPONSE,
    });
  } catch (error) {
    console.error("[MyOrders Request Access] Error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}
