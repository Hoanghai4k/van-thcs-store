/**
 * Product storage operations.
 * Upload/delete product assets and files via authenticated Supabase client.
 *
 * product-assets = PUBLIC bucket (thumbnails, previews)
 * product-files  = PRIVATE bucket (DOCX, ZIP product files)
 *
 * All operations use the authenticated admin session + Storage RLS.
 * No service_role key is used or needed.
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { STORAGE_BUCKETS } from "@/lib/constants";
import {
  getProductAssetPath,
  getProductFilePath,
  isAllowedImageType,
  validateProductFile,
  getSafeExtension,
} from "@/lib/storage/storage";

// ─── Constants ─────────────────────────────────────────────────────

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Asset Upload (Public — thumbnails, previews) ──────────────────

export interface UploadResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Upload a product asset (thumbnail or preview image).
 * Validates type and size client-side before uploading.
 */
export async function uploadProductAsset(
  productId: string,
  file: File,
): Promise<UploadResult> {
  if (!isAllowedImageType(file.type)) {
    return { success: false, error: "Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP." };
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return { success: false, error: "Dung lượng ảnh vượt quá 10 MB." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "webp";
  const uniqueName = `${crypto.randomUUID()}.${ext}`;
  const storagePath = getProductAssetPath(productId, uniqueName);

  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.PRODUCT_ASSETS)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("[Storage] Asset upload error:", error.message);
    return { success: false, error: "Không thể tải ảnh lên. Vui lòng thử lại." };
  }

  return { success: true, path: storagePath };
}

/**
 * Delete a product asset from storage.
 */
export async function deleteProductAsset(
  storagePath: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.PRODUCT_ASSETS)
    .remove([storagePath]);

  if (error) {
    console.error("[Storage] Asset delete error:", error.message);
    return { success: false, error: "Không thể xóa ảnh." };
  }

  return { success: true };
}

// ─── File Upload (Private — DOCX, ZIP product files) ───────────────

/**
 * Upload a product file (DOCX or ZIP).
 * Validates extension, MIME, and size client-side before uploading.
 * Storage key uses UUID + safe extension (never original filename).
 */
export async function uploadProductFile(
  productId: string,
  file: File,
): Promise<UploadResult> {
  // Validate extension + MIME + size
  const validationError = validateProductFile(file.name, file.type, file.size);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Get safe extension (already validated by validateProductFile)
  const safeExt = getSafeExtension(file.name, file.type);
  if (!safeExt) {
    return { success: false, error: "Định dạng file không hợp lệ." };
  }

  const uniqueName = `${crypto.randomUUID()}.${safeExt}`;
  const storagePath = getProductFilePath(productId, uniqueName);

  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.PRODUCT_FILES)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("[Storage] File upload error:", error.message);
    return { success: false, error: "Không thể tải tệp lên. Vui lòng thử lại." };
  }

  return { success: true, path: storagePath };
}

/**
 * Delete a product file from storage.
 */
export async function deleteProductFileFromStorage(
  storagePath: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.PRODUCT_FILES)
    .remove([storagePath]);

  if (error) {
    console.error("[Storage] File delete error:", error.message);
    return { success: false, error: "Không thể xóa file." };
  }

  return { success: true };
}
