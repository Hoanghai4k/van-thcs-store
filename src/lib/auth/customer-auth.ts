/**
 * Customer authentication and authorization utilities.
 *
 * Separates concerns:
 * - AUTH USER: Identity in Supabase auth.users (session, JWT, verified email)
 * - CUSTOMER: Business identity in public.customers (orders, profile)
 *
 * Normal account operations use getSupabaseServerClient() with RLS.
 * Service Role (getSupabaseAdmin) is restricted to the narrow, trusted
 * server-side linking operation where auth identity has already been verified.
 */

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeEmail, escapeLikePattern } from "@/lib/utils";

export interface CustomerAccount {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  phone: string | null;
  createdAt: string;
}

export interface CustomerLinkResult {
  success: boolean;
  customerId?: string;
  conflict?: boolean;
  error?: string;
}

/**
 * Validate and sanitize redirect destinations to prevent open redirect vulnerabilities.
 * Only internal application paths starting with a single '/' are allowed.
 */
export function getSafeRedirect(redirectUrl: string | null | undefined): string {
  if (!redirectUrl) return "/account";
  const trimmed = redirectUrl.trim();

  // Must start with '/' but not '//' (protocol-relative) or '/\' (backslash evasion)
  // Must not contain '://' (absolute protocol URLs)
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes("://")
  ) {
    return trimmed;
  }

  return "/account";
}

/**
 * Get current authenticated user from Supabase SSR session, or null if unauthenticated.
 */
export async function getCurrentAuthUser(): Promise<User | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * Get customer business profile for the current authenticated user.
 * Executes through customer's authenticated session, enforcing database RLS.
 */
export async function getCurrentCustomer(): Promise<CustomerAccount | null> {
  try {
    const user = await getCurrentAuthUser();
    if (!user) return null;

    const supabase = await getSupabaseServerClient();
    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, auth_user_id, email, name, phone, created_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error || !customer || !customer.auth_user_id) {
      return null;
    }

    return {
      id: customer.id,
      authUserId: customer.auth_user_id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      createdAt: customer.created_at,
    };
  } catch {
    return null;
  }
}

/**
 * Require customer authentication for protected pages (/account, etc.).
 * Redirects to /login if unauthenticated.
 * If user is authenticated but not yet linked to a customer row, attempts JIT linking.
 */
export async function requireCustomer(
  requestedPath = "/account",
): Promise<{ user: User; customer: CustomerAccount }> {
  const user = await getCurrentAuthUser();

  if (!user) {
    const safeTarget = getSafeRedirect(requestedPath);
    redirect(`/login?redirect=${encodeURIComponent(safeTarget)}`);
  }

  let customer = await getCurrentCustomer();

  if (!customer) {
    // Attempt JIT linking for newly confirmed user
    const linkResult = await linkVerifiedAuthUserToCustomer(user);

    if (linkResult.success) {
      customer = await getCurrentCustomer();
    } else if (linkResult.conflict) {
      redirect("/login?error=account_conflict");
    }
  }

  if (!customer) {
    redirect("/login?error=account_not_found");
  }

  return { user, customer };
}

/**
 * Security-critical JIT linking: links a verified Supabase auth user to public.customers.
 *
 * INVARIANTS:
 * - NEVER accepts email or user id from client payload.
 * - Source of truth is user.email verified by Supabase Auth.
 * - Matches using case-insensitive email semantics (LOWER(email)).
 * - Implements strict state machine (Cases A, B, C, D).
 * - Idempotent and concurrency-safe.
 */
export async function linkVerifiedAuthUserToCustomer(
  user: User,
): Promise<CustomerLinkResult> {
  if (!user || !user.id || !user.email) {
    return { success: false, error: "Thông tin xác thực không hợp lệ." };
  }

  // Ensure email ownership was confirmed
  const isConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
  if (!isConfirmed) {
    return { success: false, error: "Email chưa được xác thực." };
  }

  const normalizedEmail = normalizeEmail(user.email);
  const escapedPattern = escapeLikePattern(normalizedEmail);
  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Lookup existing customer row by escaped literal case-insensitive pattern
    const { data: existing, error: queryError } = await supabaseAdmin
      .from("customers")
      .select("id, auth_user_id, email, name")
      .ilike("email", escapedPattern)
      .maybeSingle();

    if (queryError) {
      console.error("[CustomerAuth] Query error during linking:", queryError.message);
      return { success: false, error: "Lỗi kết nối cơ sở dữ liệu." };
    }

    // Invariant: verify exact normalized email equality (defense-in-depth against pattern collision)
    if (existing && normalizeEmail(existing.email) !== normalizedEmail) {
      console.error("[CustomerAuth] Email mismatch guard triggered: pattern matched unintended row", {
        expected: normalizedEmail,
        found: existing.email,
      });
      return {
        success: false,
        error: "Không thể xác định chính xác tài khoản khách hàng.",
      };
    }

    // CASE B: Already linked to current auth user (Idempotent success)
    if (existing && existing.auth_user_id === user.id) {
      return { success: true, customerId: existing.id };
    }

    // CASE C: Existing customer linked to DIFFERENT auth user (Security Conflict)
    if (existing && existing.auth_user_id && existing.auth_user_id !== user.id) {
      console.error("[CustomerAuth] customer_link_conflict: email already linked to different auth_user_id", {
        customerId: existing.id,
        existingAuthUserId: existing.auth_user_id,
        attemptedAuthUserId: user.id,
      });
      return {
        success: false,
        conflict: true,
        error: "Email này đã được liên kết với một tài khoản khác. Vui lòng liên hệ hỗ trợ.",
      };
    }

    // CASE A: Existing guest customer row with auth_user_id IS NULL -> Link it
    if (existing && existing.auth_user_id === null) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("customers")
        .update({ auth_user_id: user.id })
        .eq("id", existing.id)
        .is("auth_user_id", null) // Concurrency guard
        .select("id, auth_user_id")
        .maybeSingle();

      if (updateError) {
        console.error("[CustomerAuth] Update error during linking:", updateError.message);
        return { success: false, error: "Không thể liên kết tài khoản." };
      }

      if (updated && updated.auth_user_id === user.id) {
        console.log("[CustomerAuth] Successfully linked historical customer to auth user", {
          customerId: existing.id,
          userId: user.id,
        });
        return { success: true, customerId: updated.id };
      }

      // Re-read if update returned null due to concurrent execution
      const { data: rechecked } = await supabaseAdmin
        .from("customers")
        .select("id, auth_user_id")
        .eq("id", existing.id)
        .single();

      if (rechecked?.auth_user_id === user.id) {
        return { success: true, customerId: rechecked.id };
      }

      console.error("[CustomerAuth] customer_link_race_conflict on update", {
        customerId: existing.id,
        recheckedAuthUserId: rechecked?.auth_user_id,
      });
      return {
        success: false,
        conflict: true,
        error: "Email này đã được liên kết với một tài khoản khác. Vui lòng liên hệ hỗ trợ.",
      };
    }

    // CASE D: No customer exists for verified email -> Create new customer record
    // customers.name is NOT NULL in schema: use metadata name or neutral default "Khách hàng"
    const name =
      (user.user_metadata?.name as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined) ||
      "Khách hàng";

    const { data: created, error: insertError } = await supabaseAdmin
      .from("customers")
      .insert({
        name,
        email: normalizedEmail,
        auth_user_id: user.id,
      })
      .select("id, auth_user_id")
      .single();

    if (insertError) {
      // Handle insert race condition (another request created the row concurrently)
      console.warn("[CustomerAuth] customer_link_insert_race, retrying lookup", {
        code: insertError.code,
        message: insertError.message,
      });

      const { data: raceCustomer } = await supabaseAdmin
        .from("customers")
        .select("id, auth_user_id, email")
        .ilike("email", escapedPattern)
        .maybeSingle();

      if (raceCustomer && normalizeEmail(raceCustomer.email) === normalizedEmail) {
        if (raceCustomer.auth_user_id === user.id) {
          return { success: true, customerId: raceCustomer.id };
        }
        if (raceCustomer.auth_user_id === null) {
          await supabaseAdmin
            .from("customers")
            .update({ auth_user_id: user.id })
            .eq("id", raceCustomer.id)
            .is("auth_user_id", null);
          return { success: true, customerId: raceCustomer.id };
        }
        return {
          success: false,
          conflict: true,
          error: "Email này đã được liên kết với một tài khoản khác. Vui lòng liên hệ hỗ trợ.",
        };
      }

      console.error("[CustomerAuth] auth_verified_but_customer_link_failed", {
        error: insertError.message,
      });
      return { success: false, error: "Không thể tạo thông tin khách hàng." };
    }

    console.log("[CustomerAuth] Created new customer row for verified auth user", {
      customerId: created.id,
      userId: user.id,
    });
    return { success: true, customerId: created.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CustomerAuth] Exception during linking:", message);
    return { success: false, error: "Lỗi hệ thống khi liên kết tài khoản." };
  }
}
