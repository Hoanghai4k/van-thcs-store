/**
 * Product data queries.
 * All queries use Supabase via server client.
 * Public storefront queries filter is_active = true.
 * Admin queries return all products.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductWithCategory, ProductListResult, ProductType } from "./types";
import { productTypeSchema } from "./schema";
import type { DbCategory } from "@/types/database";
import { PAGINATION } from "@/lib/constants";

function parseProductType(val: unknown): ProductType {
  const result = productTypeSchema.safeParse(val);
  if (!result.success) {
    console.error(`[Products] Invalid product_type encountered: ${val}. Defaulting to PAID.`);
    return "PAID";
  }
  return result.data;
}

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
    product_type: parseProductType(row.product_type),
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
    product_type: parseProductType(data.product_type),
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
    product_type: parseProductType(data.product_type),
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
    product_type: parseProductType(row.product_type),
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
    product_type: parseProductType(row.product_type),
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
    product_type: parseProductType(row.product_type),
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

/**
 * Fetch a lightweight list of all products for relation management dropdowns.
 */
export async function getAllProductsLight(): Promise<Array<{id: string, name: string, product_type: ProductType, is_active: boolean}>> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, product_type, is_active")
    .order("name", { ascending: true });

  if (error) {
    console.error("[Products] Light list error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    ...row,
    product_type: parseProductType(row.product_type),
  }));
}

export interface ProductRelationGroup {
  fullVersions: ProductWithCategory[];
  freePreviews: ProductWithCategory[];
  related: ProductWithCategory[];
}

export async function getProductRelations(productId: string): Promise<ProductRelationGroup> {
  const supabase = await getSupabaseServerClient();
  
  const result: ProductRelationGroup = {
    fullVersions: [],
    freePreviews: [],
    related: []
  };

  // Fetch relations where this product is the source
  const { data: outData, error: outError } = await supabase
    .from("product_relations")
    .select("relation_type, target_product:products!target_product_id(*, category:categories(*))")
    .eq("source_product_id", productId)
    .order("sort_order", { ascending: true });

  if (outError) {
    console.error("[Products] Error fetching outbound relations:", outError.message);
  } else {
    for (const rel of outData || []) {
      const p = rel.target_product as any;
      if (!p) continue;
      const parsed = {
        ...p,
        product_type: parseProductType(p.product_type),
        category: p.category as DbCategory | null
      } as ProductWithCategory;
      
      if (rel.relation_type === "PREVIEW_OF") {
        result.fullVersions.push(parsed);
      } else if (rel.relation_type === "RELATED") {
        result.related.push(parsed);
      }
    }
  }

  // Fetch relations where this product is the target (reverse lookup)
  const { data: inData, error: inError } = await supabase
    .from("product_relations")
    .select("relation_type, source_product:products!source_product_id(*, category:categories(*))")
    .eq("target_product_id", productId)
    .order("sort_order", { ascending: true });

  if (inError) {
    console.error("[Products] Error fetching inbound relations:", inError.message);
  } else {
    for (const rel of inData || []) {
      const p = rel.source_product as any;
      if (!p) continue;
      const parsed = {
        ...p,
        product_type: parseProductType(p.product_type),
        category: p.category as DbCategory | null
      } as ProductWithCategory;
      
      if (rel.relation_type === "PREVIEW_OF") {
        result.freePreviews.push(parsed);
      } else if (rel.relation_type === "RELATED") {
        // Typically related is not symmetrical on storefront, but could be added here if needed.
      }
    }
  }

  return result;
}
