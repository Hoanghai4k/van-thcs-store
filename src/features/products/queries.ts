/**
 * Product data queries.
 * All queries use Supabase via server client.
 * Public storefront queries filter is_active = true.
 * Admin queries return all products.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductWithCategory, ProductListResult } from "./types";
import type { DbCategory } from "@/types/database";
import { PAGINATION } from "@/lib/constants";

// ─── Public Storefront Queries ─────────────────────────────────────

export async function getProducts(params?: {
  categorySlug?: string;
  page?: number;
  pageSize?: number;
}): Promise<ProductListResult> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await getSupabaseServerClient();

  let query = supabase
    .from("products")
    .select("*, category:categories(*)", { count: "exact" })
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (params?.categorySlug) {
    query = query.eq("category.slug", params.categorySlug);
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("[Products] Error listing products:", error.message);
    return { products: [], total: 0, page, pageSize, totalPages: 0 };
  }

  // When filtering by category slug, Supabase returns all rows but with
  // category = null for non-matching joins. Filter those out.
  let products: ProductWithCategory[] = (data ?? []).map((row) => ({
    ...row,
    category: row.category as DbCategory | null,
  }));

  if (params?.categorySlug) {
    products = products.filter((p) => p.category !== null);
  }

  const total = params?.categorySlug ? products.length : (count ?? 0);

  return {
    products,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductWithCategory | null> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    ...data,
    category: data.category as DbCategory | null,
  };
}

export async function getProductById(
  id: string,
): Promise<ProductWithCategory | null> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    ...data,
    category: data.category as DbCategory | null,
  };
}

export async function getProductsByIds(
  ids: string[],
): Promise<ProductWithCategory[]> {
  if (ids.length === 0) return [];

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .in("id", ids)
    .eq("is_active", true);

  if (error || !data) {
    console.error("[Products] Error fetching by IDs:", error?.message);
    return [];
  }

  return data.map((row) => ({
    ...row,
    category: row.category as DbCategory | null,
  }));
}

export async function getFeaturedProducts(
  limit: number = 4,
): Promise<ProductWithCategory[]> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("[Products] Error fetching featured:", error?.message);
    return [];
  }

  return data.map((row) => ({
    ...row,
    category: row.category as DbCategory | null,
  }));
}

// ─── Legacy aliases (used by storefront pages) ─────────────────────

export async function getCategories(): Promise<DbCategory[]> {
  const { listActiveCategories } = await import("@/features/categories/queries");
  return listActiveCategories();
}

export async function getCategoryBySlug(
  slug: string,
): Promise<DbCategory | null> {
  const { getActiveCategoryBySlug } = await import("@/features/categories/queries");
  return getActiveCategoryBySlug(slug);
}

// ─── Admin Queries ─────────────────────────────────────────────────

export async function getAdminProducts(params?: {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<ProductListResult> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await getSupabaseServerClient();

  let query = supabase
    .from("products")
    .select("*, category:categories(*)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params?.search) {
    query = query.ilike("name", `%${params.search}%`);
  }

  if (params?.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }

  if (params?.isActive !== undefined) {
    query = query.eq("is_active", params.isActive);
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("[Products] Admin list error:", error.message);
    return { products: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const products: ProductWithCategory[] = (data ?? []).map((row) => ({
    ...row,
    category: row.category as DbCategory | null,
  }));

  const total = count ?? 0;

  return {
    products,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
