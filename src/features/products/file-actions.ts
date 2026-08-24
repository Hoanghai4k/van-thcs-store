/**
 * Product file management server actions.
 * Handles DB metadata for uploaded product files (DOCX, ZIP).
 * All mutations require admin authentication.
 */

"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { syncProductFileCount } from "./actions";
import type { ApiResponse } from "@/types/common";
import type { DbProductFile, DbProductPreview } from "@/types/database";
import { PDFDocument } from "pdf-lib";
import { STORAGE_BUCKETS } from "@/lib/constants";

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

/**
 * Handle server-side upload of a PDF preview.
 * This is a server action to securely read the PDF page count and upload it.
 */
export async function uploadProductPreview(
  productId: string,
  formData: FormData
): Promise<ApiResponse<DbProductPreview>> {
  await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "Không tìm thấy file." };
  }

  if (file.type !== "application/pdf") {
    return { success: false, error: "Chỉ chấp nhận định dạng PDF." };
  }

  if (file.size > 20 * 1024 * 1024) {
    return { success: false, error: "Dung lượng file vượt quá 20MB." };
  }

  const supabase = await getSupabaseServerClient();

  // Validate PDF and get page count
  let pageCount = 0;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    pageCount = pdfDoc.getPageCount();
  } catch (err) {
    console.error("[ProductPreview] PDF parse error:", err);
    return { success: false, error: "Không thể đọc nội dung file PDF. File có thể bị hỏng hoặc mã hóa." };
  }

  if (pageCount < 1 || pageCount > 10) {
    return { success: false, error: `Số trang không hợp lệ (${pageCount} trang). Chỉ cho phép từ 1 đến 10 trang.` };
  }

  // Ensure product is PAID
  const { data: product } = await supabase.from("products").select("product_type").eq("id", productId).single();
  if (product?.product_type !== "PAID") {
    return { success: false, error: "Xem trước chỉ áp dụng cho sản phẩm trả phí (PAID)." };
  }

  // Upload to Storage
  const uniqueName = `${crypto.randomUUID()}.pdf`;
  const storagePath = `${productId}/${uniqueName}`;
  
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.PRODUCT_PREVIEWS)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("[ProductPreview] Upload error:", uploadError.message);
    return { success: false, error: "Không thể tải lên Storage." };
  }

  // Delete existing preview if any (from DB and Storage)
  const { data: existingPreview } = await supabase.from("product_previews").select("id, storage_path").eq("product_id", productId).maybeSingle();
  
  if (existingPreview) {
    await supabase.storage.from(STORAGE_BUCKETS.PRODUCT_PREVIEWS).remove([existingPreview.storage_path]);
    await supabase.from("product_previews").delete().eq("id", existingPreview.id);
  }

  // Insert to DB
  const { data: previewRecord, error: insertError } = await supabase
    .from("product_previews")
    .insert({
      product_id: productId,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: "application/pdf",
      file_size: file.size,
      page_count: pageCount,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[ProductPreview] DB insert error:", insertError.message);
    // Cleanup storage
    await supabase.storage.from(STORAGE_BUCKETS.PRODUCT_PREVIEWS).remove([storagePath]);
    return { success: false, error: "Không thể lưu thông tin xem trước vào database." };
  }

  revalidatePath(`/admin/products/${productId}`);
  return { success: true, data: previewRecord };
}

export async function deleteProductPreview(productId: string, storagePath: string): Promise<ApiResponse<null>> {
  await requireAdmin();
  const supabase = await getSupabaseServerClient();

  const { error: storageError } = await supabase.storage.from(STORAGE_BUCKETS.PRODUCT_PREVIEWS).remove([storagePath]);
  if (storageError) {
    console.error("[ProductPreview] Storage delete error:", storageError.message);
  }

  const { error: dbError } = await supabase.from("product_previews").delete().eq("product_id", productId);
  if (dbError) {
    console.error("[ProductPreview] DB delete error:", dbError.message);
    return { success: false, error: "Không thể xóa bản ghi xem trước." };
  }

  revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}
