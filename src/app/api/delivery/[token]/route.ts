import { NextResponse, NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { validateDeliveryToken } from "@/features/downloads/service";
import { setDeliveryAccessCookie } from "@/lib/auth/delivery-access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params;
  const baseUrl = request.nextUrl.origin;

  if (!rawToken) {
    return NextResponse.redirect(new URL(`/delivery/invalid?error=invalid_token`, baseUrl));
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const result = await validateDeliveryToken(rawToken, supabaseAdmin);

    if (!result.valid || !result.grant || !result.orderCode) {
      console.warn("[DeliveryAPI] Token validation failed", {
        tokenValid: result.valid,
        error: result.error,
      });
      const errorCode = result.error === "Đơn hàng chưa đủ điều kiện tải tài liệu." 
        ? "not_eligible" 
        : "invalid_token";
      return NextResponse.redirect(new URL(`/delivery/${rawToken}?error=${errorCode}`, baseUrl));
    }

    console.info("[DeliveryAPI] Token validated successfully", {
      tokenValid: true,
      orderFound: true,
      orderCode: result.orderCode,
    });

    // Create redirect response
    const response = NextResponse.redirect(new URL(`/order/${result.orderCode}/downloads`, baseUrl));

    // Set HttpOnly cookie FROM THE ROUTE HANDLER
    setDeliveryAccessCookie(response, result.grant.id, result.grant.orderId);

    return response;
  } catch (error) {
    console.error("[DeliveryAPI] Exception during delivery token activation", {
      failingFunction: "GET /api/delivery/[token]",
      errorName: (error as Error).name,
      errorMessage: (error as Error).message,
    });
    return NextResponse.redirect(new URL(`/delivery/${rawToken}?error=system`, baseUrl));
  }
}
