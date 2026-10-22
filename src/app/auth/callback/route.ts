import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  linkVerifiedAuthUserToCustomer,
  getSafeRedirect,
} from "@/lib/auth/customer-auth";

/**
 * Supabase Auth Callback Route Handler.
 * Handles magic link tokens, email OTP redirects, and PKCE authorization code exchanges.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const safeRedirect = getSafeRedirect(next);

  try {
    const supabase = await getSupabaseServerClient();

    // 1. Verify via token_hash (standard Supabase magic link / OTP link format)
    if (token_hash && type) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type,
      });

      if (!error && data.user) {
        await linkVerifiedAuthUserToCustomer(data.user);
        return NextResponse.redirect(new URL(safeRedirect, request.url));
      }

      console.error("[AuthCallback] token_hash verification error:", error?.message);
    }

    // 2. Exchange authorization code for session (PKCE flow)
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.user) {
        await linkVerifiedAuthUserToCustomer(data.user);
        return NextResponse.redirect(new URL(safeRedirect, request.url));
      }

      console.error("[AuthCallback] code exchange error:", error?.message);
    }

    // Fallback if verification failed
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "Liên kết xác thực không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
        )}`,
        request.url,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AuthCallback] Exception during callback processing:", message);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Đã xảy ra lỗi trong quá trình xác thực.")}`,
        request.url,
      ),
    );
  }
}
