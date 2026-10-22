"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Customer logout Server Action.
 * Clears Supabase Auth cookies and redirects to home page.
 */
export async function logoutCustomer(): Promise<void> {
  try {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("[CustomerAuth] Error during signOut:", error);
  }
  redirect("/");
}
