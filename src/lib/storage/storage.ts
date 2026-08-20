/**
 * Storage service for managing product files and assets.
 *
 * Product files (.docx) are stored in a PRIVATE Supabase storage bucket.
 * They are NEVER publicly accessible. Downloads are served via
 * time-limited signed URLs after token validation.
 *
 * Product assets (thumbnails, previews) are in a PUBLIC bucket.
 *
 * Storage path conventions:
 *   Assets:  products/{product_id}/assets/{unique_filename}
 *   Files:   products/{product_id}/files/{uuid}.docx
 */

import { STORAGE_BUCKETS } from "@/lib/constants";

// ─── Size Limits ───────────────────────────────────────────────────

/** Maximum image file size: 10 MB */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Maximum .docx file size: 50 MB */
export const MAX_DOCX_SIZE = 50 * 1024 * 1024;

// ─── Path Builders ─────────────────────────────────────────────────

/**
 * Build the storage path for a product file (private .docx).
 */
export function getProductFilePath(
  productId: string,
  fileName: string,
): string {
  return `products/${productId}/files/${fileName}`;
}

/**
 * Build the storage path for a product asset (public image).
 */
export function getProductAssetPath(
  productId: string,
  fileName: string,
): string {
  return `products/${productId}/assets/${fileName}`;
}

// ─── Bucket Names ──────────────────────────────────────────────────

/**
 * Get the storage bucket name for product files (private).
 */
export function getProductFilesBucket(): string {
  return STORAGE_BUCKETS.PRODUCT_FILES;
}

/**
 * Get the storage bucket name for product assets (public).
 */
export function getProductAssetsBucket(): string {
  return STORAGE_BUCKETS.PRODUCT_ASSETS;
}

// ─── Public URL Builder ────────────────────────────────────────────

/**
 * Convert a product-assets storage path to its public URL.
 * Only for the PUBLIC bucket (product-assets). NEVER for product-files.
 *
 * @param storagePath The path within the product-assets bucket
 * @returns Full public URL
 */
export function getProductAssetUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKETS.PRODUCT_ASSETS}/${storagePath}`;
}

// ─── Validators ────────────────────────────────────────────────────

/**
 * Validate that a file has an allowed MIME type for product documents.
 */
export function isAllowedDocumentType(mimeType: string): boolean {
  return (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

/**
 * Validate that a file has an allowed MIME type for product assets (images).
 */
export function isAllowedImageType(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
}

/**
 * Validate that a filename has a .docx extension.
 */
export function isDocxExtension(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".docx");
}
