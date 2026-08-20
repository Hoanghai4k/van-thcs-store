/**
 * Admin authentication and authorization utilities.
 *
 * Uses Supabase Auth via @supabase/ssr for session management.
 * Admin identity is verified by checking the admin_users table
 * against auth.uid() — no client-provided role or claim is trusted.
 *
 * Architecture:
 *   auth.uid()  →  admin_users.user_id  →  authorized
 *
 * The private.is_admin() PostgreSQL function mirrors this logic at the DB level
 * for RLS policies. This module provides the application-level equivalent.
 */

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
}

/**
 * Get the current authenticated admin user, or null if not an admin.
 *
 * 1. Gets Supabase session via SSR cookies
 * 2. Verifies user exists in admin_users table
 * 3. Returns admin info or null
 */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  try {
    const supabase = await getSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    // Check admin_users table — RLS allows self-read
    const { data: adminRow, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (adminError || !adminRow) {
      return null;
    }

    return {
      id: user.id,
      email: user.email ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Check if the current authenticated user is an admin.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const admin = await getCurrentAdmin();
  return admin !== null;
}

/**
 * Require admin authentication. Redirects to /admin/login if not authenticated
 * or not an admin. Use at the top of Server Components/layouts.
 *
 * @returns The authenticated admin user (guaranteed non-null)
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in at all → login page
  if (!user) {
    redirect("/admin/login");
  }

  // Logged in but not admin → sign out and redirect
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (!adminRow) {
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  return {
    id: user.id,
    email: user.email ?? "",
  };
}

/**
 * Sign out the current admin user.
 */
export async function signOutAdmin(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
}
