/**
 * Category server actions.
 * All mutations require admin authentication.
 */

"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { categorySchema } from "./schema";
import type { ApiResponse } from "@/types/common";
import type { DbCategory } from "@/types/database";

/**
 * Create a new category.
 */
export async function createCategory(
  formData: unknown,
): Promise<ApiResponse<DbCategory>> {
  await requireAdmin();

  const result = categorySchema.safeParse(formData);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map((e) => e.message).join(", "),
    };
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: result.data.name,
      slug: result.data.slug,
      description: result.data.description ?? null,
      is_active: result.data.is_active,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Slug này đã được sử dụng." };
    }
    console.error("[Categories] Create error:", error.message);
    return { success: false, error: "Không thể tạo danh mục. Vui lòng thử lại." };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  revalidatePath("/");
  return { success: true, data };
}

/**
 * Update an existing category.
 */
export async function updateCategory(
  id: string,
  formData: unknown,
): Promise<ApiResponse<DbCategory>> {
  await requireAdmin();

  const result = categorySchema.safeParse(formData);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map((e) => e.message).join(", "),
    };
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("categories")
    .update({
      name: result.data.name,
      slug: result.data.slug,
      description: result.data.description ?? null,
      is_active: result.data.is_active,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Slug này đã được sử dụng." };
    }
    console.error("[Categories] Update error:", error.message);
    return { success: false, error: "Không thể cập nhật danh mục." };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  revalidatePath("/");
  return { success: true, data };
}

/**
 * Toggle category active status.
 */
export async function toggleCategoryActive(
  id: string,
  isActive: boolean,
): Promise<ApiResponse<null>> {
  await requireAdmin();

  const supabase = await getSupabaseServerClient();

  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("[Categories] Toggle error:", error.message);
    return { success: false, error: "Không thể thay đổi trạng thái danh mục." };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  revalidatePath("/");
  return { success: true };
}
