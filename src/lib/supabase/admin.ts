/**
 * Supabase admin client with service role key.
 * ONLY use this server-side for privileged operations that bypass RLS:
 * - Creating orders
 * - Updating payment status
 * - Generating download tokens
 * - Admin operations
 *
 * NEVER expose the service role key to the client.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
        "These must be set in .env.local for server-side operations.",
    );
  }

  adminClient = createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
