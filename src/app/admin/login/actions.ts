"use server";

/**
 * Admin login server action.
 *
 * Uses Supabase Auth signInWithPassword.
 * After successful auth, verifies the user exists in admin_users.
 * If not an admin, signs out immediately and returns an error.
 *
 * NEVER creates admin accounts — first admin is bootstrapped manually.
 */

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface LoginResult {
  error?: string;
}

export async function loginAdmin(formData: FormData): Promise<LoginResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email và mật khẩu là bắt buộc." };
  }

  const supabase = await getSupabaseServerClient();

  // 1. Authenticate with Supabase Auth
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !data.user) {
    return { error: "Email hoặc mật khẩu không đúng." };
  }

  // 2. Verify this user is in admin_users
  const { data: adminRow, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .single();

  if (adminError || !adminRow) {
    // Not an admin — sign out immediately
    await supabase.auth.signOut();
    return { error: "Tài khoản không có quyền quản trị." };
  }

  // 3. Success — redirect to admin dashboard
  redirect("/admin");
}

export async function logoutAdmin(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
