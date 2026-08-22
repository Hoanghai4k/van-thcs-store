/**
 * Product server actions.
 * All mutations require admin authentication via requireAdmin().
 */

"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { createProductSchema, updateProductSchema } from "./schema";
import type { ApiResponse } from "@/types/common";
import type { DbProduct } from "@/types/database";

/**
 * Create a new product (always starts as inactive draft).
 */
export async function createProduct(
  formData: unknown,
): Promise<ApiResponse<DbProduct>> {
  await requireAdmin();

  const result = createProductSchema.safeParse(formData);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map((e) => e.message).join(", "),
    };
  }

  const supabase = await getSupabaseServerClient();
  const d = result.data;

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: d.name,
      slug: d.slug,
      short_description: d.shortDescription ?? null,
      description: d.description ?? null,
      price: d.price,
      original_price: d.originalPrice ?? null,
      category_id: d.categoryId ?? null,
      thumbnail_path: d.thumbnailPath ?? null,
      preview_images: d.previewImages ?? null,
      is_active: false, // Always start as draft
      page_count: d.pageCount ?? null,
      file_format: d.fileFormat ?? "docx",
      product_type: d.productType ?? "PAID",
      features: d.features ?? null,
      suitable_for: d.suitableFor ?? null,
      file_count: 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Slug này đã được sử dụng." };
    }
    if (error.code === "23514") {
      return { success: false, error: "Dữ liệu không hợp lệ (vi phạm ràng buộc database)." };
    }
    if (error.code === "23503") {
      return { success: false, error: "Danh mục không tồn tại." };
    }
    if (error.code === "42501") {
      return { success: false, error: "Bạn không có quyền thực hiện thao tác này." };
    }
    console.error("[Products] Create error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { success: false, error: "Không thể tạo sản phẩm. Vui lòng thử lại." };
  }

  // Process relations
  await syncProductRelations(supabase, data.id, d.previewOfIds, d.relatedIds);

  revalidatePath("/admin/products");
  return { success: true, data };
}

/**
 * Update an existing product.
 */
export async function updateProduct(
  id: string,
  formData: unknown,
): Promise<ApiResponse<DbProduct>> {
  await requireAdmin();

  const result = updateProductSchema.safeParse(formData);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map((e) => e.message).join(", "),
    };
  }

  const supabase = await getSupabaseServerClient();
  const d = result.data;

  // Build update object — only include provided fields
  const updateData: {
    name?: string;
    slug?: string;
    short_description?: string | null;
    description?: string | null;
    price?: number;
    original_price?: number | null;
    category_id?: string | null;
    thumbnail_path?: string | null;
    preview_images?: string[] | null;
    page_count?: number | null;
    file_format?: string;
    product_type?: "PAID" | "FREE";
    features?: string[] | null;
    suitable_for?: string[] | null;
  } = {};

  if (d.name !== undefined) updateData.name = d.name;
  if (d.slug !== undefined) updateData.slug = d.slug;
  if (d.shortDescription !== undefined) updateData.short_description = d.shortDescription;
  if (d.description !== undefined) updateData.description = d.description;
  if (d.price !== undefined) updateData.price = d.price;
  if (d.originalPrice !== undefined) updateData.original_price = d.originalPrice;
  if (d.categoryId !== undefined) updateData.category_id = d.categoryId;
  if (d.thumbnailPath !== undefined) updateData.thumbnail_path = d.thumbnailPath;
  if (d.previewImages !== undefined) updateData.preview_images = d.previewImages;
  if (d.pageCount !== undefined) updateData.page_count = d.pageCount;
  if (d.fileFormat !== undefined) updateData.file_format = d.fileFormat;
  if (d.productType !== undefined) updateData.product_type = d.productType;
  if (d.features !== undefined) updateData.features = d.features;
  if (d.suitableFor !== undefined) updateData.suitable_for = d.suitableFor;

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: "Không có thay đổi nào." };
  }

  const { data, error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Slug này đã được sử dụng." };
    }
    if (error.code === "23514") {
      return { success: false, error: "Dữ liệu không hợp lệ (vi phạm ràng buộc database)." };
    }
    if (error.code === "42501") {
      return { success: false, error: "Bạn không có quyền thực hiện thao tác này." };
    }
    console.error("[Products] Update error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { success: false, error: "Không thể cập nhật sản phẩm." };
  }

  // Process relations
  await syncProductRelations(supabase, id, d.previewOfIds, d.relatedIds);

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/products");
  revalidatePath("/");
  return { success: true, data };
}

/**
 * Toggle product active status.
 * Activation requires at least 1 deliverable file (DOCX or ZIP).
 */
export async function toggleProductActive(
  id: string,
  isActive: boolean,
): Promise<ApiResponse<null>> {
  await requireAdmin();

  const supabase = await getSupabaseServerClient();

  // If activating, enforce activation rules
  if (isActive) {
    const { data: product } = await supabase
      .from("products")
      .select("name, slug, price, category_id, file_count")
      .eq("id", id)
      .single();

    if (!product) {
      return { success: false, error: "Sản phẩm không tồn tại." };
    }

    if (!product.name || !product.slug) {
      return { success: false, error: "Sản phẩm chưa có tên hoặc slug." };
    }

    if (!product.category_id) {
      return { success: false, error: "Sản phẩm chưa chọn danh mục." };
    }

    if (product.price < 0) {
      return { success: false, error: "Giá sản phẩm không hợp lệ." };
    }

    // Check file_count from product_files table (source of truth)
    const { count } = await supabase
      .from("product_files")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id);

    if (!count || count === 0) {
      return {
        success: false,
        error: "Không thể kích hoạt sản phẩm vì chưa có tệp tài liệu. Hãy tải lên ít nhất 1 file.",
      };
    }
  }

  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("[Products] Toggle error:", error.message);
    return { success: false, error: "Không thể thay đổi trạng thái sản phẩm." };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  return { success: true };
}

/**
 * Recalculate and sync file_count and file_format from product_files table.
 * file_format is derived from actual attached files:
 *   - "docx" if all files are DOCX
 *   - "zip" if all files are ZIP
 *   - "mixed" if both types exist
 *   - "docx" as fallback for 0 files
 */
export async function syncProductFileCount(
  productId: string,
): Promise<void> {
  const supabase = await getSupabaseServerClient();

  const { data: files, count } = await supabase
    .from("product_files")
    .select("file_name", { count: "exact" })
    .eq("product_id", productId);

  const fileFormat = deriveFileFormat(files?.map((f) => f.file_name) ?? []);

  await supabase
    .from("products")
    .update({ file_count: count ?? 0, file_format: fileFormat })
    .eq("id", productId);
}

/**
 * Synchronize product relations (PREVIEW_OF and RELATED).
 */
async function syncProductRelations(
  supabase: any,
  sourceId: string,
  previewOfIds?: string[] | null,
  relatedIds?: string[] | null
) {
  // We only sync if these arrays are provided. If undefined, do nothing.
  if (previewOfIds === undefined && relatedIds === undefined) return;

  const relationsToInsert: { source_product_id: string; target_product_id: string; relation_type: string }[] = [];

  if (previewOfIds !== undefined) {
    // Delete existing PREVIEW_OF relations where source = this product
    await supabase.from("product_relations").delete().eq("source_product_id", sourceId).eq("relation_type", "PREVIEW_OF");
    
    if (previewOfIds && previewOfIds.length > 0) {
      previewOfIds.forEach((id) => {
        if (id !== sourceId) {
          relationsToInsert.push({
            source_product_id: sourceId,
            target_product_id: id,
            relation_type: "PREVIEW_OF"
          });
        }
      });
    }
  }

  if (relatedIds !== undefined) {
    // Delete existing RELATED relations where source = this product
    await supabase.from("product_relations").delete().eq("source_product_id", sourceId).eq("relation_type", "RELATED");
    
    if (relatedIds && relatedIds.length > 0) {
      relatedIds.forEach((id) => {
        if (id !== sourceId) {
          relationsToInsert.push({
            source_product_id: sourceId,
            target_product_id: id,
            relation_type: "RELATED"
          });
        }
      });
    }
  }

  if (relationsToInsert.length > 0) {
    const { error } = await supabase.from("product_relations").insert(relationsToInsert);
    if (error) {
      console.error("[Products] Relation sync error:", error.message);
    }
  }
}

// Import deriveFileFormat from storage module (pure utility).
// Defined there because "use server" files require all exported
// functions to be async — this is a sync utility function.
import { deriveFileFormat } from "@/lib/storage/storage";
