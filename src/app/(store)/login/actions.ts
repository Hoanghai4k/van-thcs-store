"use server";

import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  linkVerifiedAuthUserToCustomer,
  getSafeRedirect,
} from "@/lib/auth/customer-auth";
import { normalizeEmail } from "@/lib/utils";
import { getSiteUrl } from "@/lib/url";

const emailSchema = z.string().email("Email không hợp lệ. Vui lòng kiểm tra lại.");
const tokenSchema = z
  .string()
  .min(6, "Mã xác thực phải gồm 6 chữ số.")
  .max(8, "Mã xác thực không hợp lệ.")
  .regex(/^[0-9a-zA-Z]+$/, "Mã xác thực chỉ chứa ký tự số hoặc chữ.");

export interface RequestOtpResult {
  success: boolean;
  email?: string;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  redirectTo?: string;
  error?: string;
}

/**
 * Request passwordless Email OTP / Magic Link.
 * Sends a 6-digit verification code to the customer's email.
 */
export async function requestOtp(
  rawEmail: string,
  rawRedirect?: string | null,
): Promise<RequestOtpResult> {
  const parseResult = emailSchema.safeParse(rawEmail?.trim());
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.errors[0]?.message || "Email không hợp lệ.",
    };
  }

  const email = normalizeEmail(parseResult.data);
  const safeRedirect = getSafeRedirect(rawRedirect);

  try {
    const supabase = await getSupabaseServerClient();
    const siteUrl = getSiteUrl();
    const callbackUrl = `${siteUrl}/auth/callback?next=${encodeURIComponent(safeRedirect)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      console.error("[CustomerAuth] signInWithOtp error:", error.message);

      // User-friendly Vietnamese rate limit / generic error messages
      if (
        error.message.toLowerCase().includes("rate limit") ||
        error.status === 429
      ) {
        return {
          success: false,
          error: "Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau.",
        };
      }

      return {
        success: false,
        error: "Không thể gửi mã xác thực lúc này. Vui lòng thử lại.",
      };
    }

    return {
      success: true,
      email,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CustomerAuth] Exception in requestOtp:", message);
    return {
      success: false,
      error: "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
    };
  }
}

/**
 * Verify 6-digit OTP code, establish session, and link customer identity.
 */
export async function verifyOtp(
  rawEmail: string,
  rawToken: string,
  rawRedirect?: string | null,
): Promise<VerifyOtpResult> {
  const emailParse = emailSchema.safeParse(rawEmail?.trim());
  const tokenParse = tokenSchema.safeParse(rawToken?.trim());

  if (!emailParse.success || !tokenParse.success) {
    return {
      success: false,
      error:
        tokenParse.error?.errors[0]?.message ||
        emailParse.error?.errors[0]?.message ||
        "Thông tin không hợp lệ.",
    };
  }

  const email = normalizeEmail(emailParse.data);
  const token = tokenParse.data.trim();
  const safeRedirect = getSafeRedirect(rawRedirect);

  try {
    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error || !data.user) {
      console.warn("[CustomerAuth] verifyOtp failed:", error?.message);

      const errMsg = error?.message?.toLowerCase() || "";
      if (errMsg.includes("expired")) {
        return {
          success: false,
          error: "Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.",
        };
      }

      if (errMsg.includes("invalid") || errMsg.includes("token")) {
        return {
          success: false,
          error: "Mã xác thực không đúng. Vui lòng kiểm tra và thử lại.",
        };
      }

      if (errMsg.includes("rate limit") || error?.status === 429) {
        return {
          success: false,
          error: "Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau.",
        };
      }

      return {
        success: false,
        error: "Không thể đăng nhập lúc này. Vui lòng thử lại.",
      };
    }

    // Step 2: JIT customer linking
    const linkResult = await linkVerifiedAuthUserToCustomer(data.user);

    if (!linkResult.success) {
      if (linkResult.conflict) {
        return {
          success: false,
          error: linkResult.error,
        };
      }
      return {
        success: false,
        error: "Không thể thiết lập hồ sơ khách hàng. Vui lòng thử lại.",
      };
    }

    return {
      success: true,
      redirectTo: safeRedirect,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CustomerAuth] Exception in verifyOtp:", message);
    return {
      success: false,
      error: "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
    };
  }
}
