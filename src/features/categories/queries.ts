/**
 * Category data queries.
 * Server-side queries for categories using Supabase.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { DbCategory } from "@/types/database";

/**
 * List active categories for the public storefront.
 */
export async function listActiveCategories(): Promise<DbCategory[]> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("[Categories] Error listing active categories:", error.message);
    return [];
  }

  return data;
}

/**
 * Get a single active category by slug. Returns null if not found or inactive.
 */
export async function getActiveCategoryBySlug(
  slug: string,
): Promise<DbCategory | null> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * List ALL categories (including inactive) for admin UI.
 */
export async function listAllCategories(): Promise<DbCategory[]> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error) {
    console.error("[Categories] Error listing all categories:", error.message);
    return [];
  }

  return data;
}

/**
 * Get a single category by ID (admin view, includes inactive).
 */
export async function getCategoryById(
  id: string,
): Promise<DbCategory | null> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
