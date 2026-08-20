/**
 * Product file management server actions.
 * Handles DB metadata for uploaded .docx files.
 * All mutations require admin authentication.
 */

"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { syncProductFileCount } from "./actions";
import type { ApiResponse } from "@/types/common";
import type { DbProductFile } from "@/types/database";

/**
 * Register a product file in the database after successful storage upload.
 */
export async function addProductFileRecord(
  productId: string,
  fileName: string,
  storagePath: string,
  fileSize: number,
  mimeType: string,
): Promise<ApiResponse<DbProductFile>> {
  await requireAdmin();

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("product_files")
    .insert({
      product_id: productId,
      file_name: fileName,
      storage_path: storagePath,
      file_size: fileSize,
      mime_type: mimeType,
    })
    .select()
    .single();

  if (error) {
    console.error("[ProductFiles] Insert error:", error.message);
    return { success: false, error: "Không thể lưu thông tin file." };
  }

  // Sync file_count on the product
  await syncProductFileCount(productId);

  revalidatePath(`/admin/products/${productId}`);
  return { success: true, data };
}

/**
 * Remove a product file record and sync file_count.
 * Storage deletion should be done separately (client-side via authenticated upload).
 */
export async function removeProductFileRecord(
  fileId: string,
  productId: string,
): Promise<ApiResponse<{ storagePath: string }>> {
  await requireAdmin();

  const supabase = await getSupabaseServerClient();

  // Check if this is the last file and product is active
  const { data: product } = await supabase
    .from("products")
    .select("is_active, file_count")
    .eq("id", productId)
    .single();

  if (product?.is_active && (product.file_count ?? 0) <= 1) {
    return {
      success: false,
      error: "Không thể xóa file cuối cùng khi sản phẩm đang hoạt động. Hãy tắt sản phẩm trước.",
    };
  }

  // Get the storage path before deleting the record
  const { data: fileRecord } = await supabase
    .from("product_files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("product_id", productId)
    .single();

  if (!fileRecord) {
    return { success: false, error: "File không tồn tại." };
  }

  const { error } = await supabase
    .from("product_files")
    .delete()
    .eq("id", fileId)
    .eq("product_id", productId);

  if (error) {
    console.error("[ProductFiles] Delete error:", error.message);
    return { success: false, error: "Không thể xóa file." };
  }

  await syncProductFileCount(productId);

  revalidatePath(`/admin/products/${productId}`);
  return { success: true, data: { storagePath: fileRecord.storage_path } };
}

/**
 * List product files for admin view.
 */
export async function getProductFiles(
  productId: string,
): Promise<DbProductFile[]> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("product_files")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[ProductFiles] List error:", error.message);
    return [];
  }

  return data;
}
