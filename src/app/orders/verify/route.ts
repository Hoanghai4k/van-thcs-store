import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken, setMyOrdersAccessCookie } from "@/lib/auth/my-orders-access";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return errorResponse("Liên kết xác minh không hợp lệ hoặc đã hết hạn.");
    }

    const verification = verifyMagicLinkToken(token);

    if (!verification.valid) {
      console.warn(`[MyOrders Verify] Token invalid: ${verification.reason}`);
      return errorResponse("Liên kết xác minh không hợp lệ hoặc đã hết hạn.");
    }

    // Success: Set My Orders Access cookie
    const url = request.nextUrl.clone();
    url.pathname = "/orders";
    url.search = ""; // clear query params

    const response = NextResponse.redirect(url);
    setMyOrdersAccessCookie(response, verification.email);

    return response;
  } catch (error) {
    console.error("[MyOrders Verify] Error:", error);
    return errorResponse("Lỗi hệ thống");
  }
}

function errorResponse(message: string) {
  // In a real app, this might redirect to /orders?error=...
  // Or render a simple HTML page.
  // For Next.js App Router API, we can return HTML directly or redirect.
  // Returning a simple HTML response with a button back to /orders is safest.
  return new NextResponse(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>Lỗi Xác Minh</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; }
        .btn { display: inline-block; padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h2>Xác Minh Thất Bại</h2>
      <p>${message}</p>
      <a href="/orders" class="btn">Gửi liên kết mới</a>
    </body>
    </html>
  `, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
