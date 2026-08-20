/**
 * Customer server actions.
 *
 * Customer records are managed server-side only (service_role).
 * Customers are contact/checkout records, not Auth users.
 */

"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/utils";

/**
 * Find or create a customer by normalized email.
 *
 * If a customer with the same email exists, update their name/phone.
 * Otherwise, create a new customer record.
 *
 * Returns the customer ID.
 */
export async function upsertCustomer(data: {
  name: string;
  email: string;
  phone: string;
}): Promise<string> {
  const supabase = getSupabaseAdmin();

  const email = normalizeEmail(data.email);
  const name = data.name.trim();
  const phone = data.phone.trim();

  // Try to find existing customer by normalized email
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .single();

  if (existing) {
    // Update name and phone in case they changed
    await supabase
      .from("customers")
      .update({ name, phone })
      .eq("id", existing.id);

    return existing.id;
  }

  // Create new customer
  const { data: created, error } = await supabase
    .from("customers")
    .insert({ name, email, phone })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[Customer] Failed to create customer:", error?.message);
    throw new Error("Không thể tạo thông tin khách hàng.");
  }

  return created.id;
}
