/**
 * Customer queries.
 * All queries use Supabase admin client (service_role).
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PAGINATION } from "@/lib/constants";

/**
 * List customers (admin use).
 */
export async function listCustomers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params?.search) {
    query = query.or(
      `name.ilike.%${params.search}%,email.ilike.%${params.search}%`,
    );
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("[Customers] List error:", error.message);
    return { customers: [], total: 0, page, pageSize, totalPages: 0 };
  }

  return {
    customers: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}
