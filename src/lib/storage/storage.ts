/**
 * Storage service for managing product files and assets.
 *
 * Product files (DOCX, ZIP) are stored in a PRIVATE Supabase storage bucket.
 * They are NEVER publicly accessible. Downloads are served via
 * time-limited signed URLs after token validation.
 *
 * Product assets (thumbnails, previews) are in a PUBLIC bucket.
 *
 * Storage path conventions:
 *   Assets:  products/{product_id}/assets/{unique_filename}
 *   Files:   products/{product_id}/files/{uuid}.{safe_extension}
 */

import { STORAGE_BUCKETS, ALLOWED_PRODUCT_FILE_MIMES, ALLOWED_FILE_EXTENSIONS, DANGEROUS_EXTENSIONS, MAX_PRODUCT_FILE_SIZE } from "@/lib/constants";

// ─── Size Limits ───────────────────────────────────────────────────

/** Maximum image file size: 10 MB */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Maximum product file size: 50 MB */
export { MAX_PRODUCT_FILE_SIZE };

/** @deprecated Use MAX_PRODUCT_FILE_SIZE */
export const MAX_DOCX_SIZE = MAX_PRODUCT_FILE_SIZE;

// ─── Path Builders ─────────────────────────────────────────────────

/**
 * Build the storage path for a product file (private).
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

// ─── Extension Helpers ─────────────────────────────────────────────

/**
 * Extract file extension from filename (lowercase, with dot).
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === fileName.length - 1) return "";
  return fileName.slice(lastDot).toLowerCase();
}

/**
 * Get the format label for a file extension (e.g., ".docx" → "DOCX").
 */
export function getFormatLabel(fileName: string): string {
  const ext = getFileExtension(fileName);
  return ext.replace(".", "").toUpperCase() || "FILE";
}

// ─── Validators ────────────────────────────────────────────────────

/**
 * Validate that a file has an allowed MIME type for product files.
 * Accepts DOCX and ZIP MIME types.
 */
export function isAllowedProductFileType(mimeType: string): boolean {
  return (ALLOWED_PRODUCT_FILE_MIMES as readonly string[]).includes(mimeType);
}

/** @deprecated Use isAllowedProductFileType */
export function isAllowedDocumentType(mimeType: string): boolean {
  return isAllowedProductFileType(mimeType);
}

/**
 * Validate that a filename has an allowed product file extension.
 * Accepts .docx and .zip (case-insensitive).
 */
export function isAllowedFileExtension(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return ext in ALLOWED_FILE_EXTENSIONS;
}

/** @deprecated Use isAllowedFileExtension */
export function isDocxExtension(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".docx");
}

/**
 * Validate that a file has an allowed MIME type for product assets (images).
 */
export function isAllowedImageType(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
}

/**
 * Check if a file extension is in the dangerous blocklist.
 */
export function isDangerousExtension(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return (DANGEROUS_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Validate extension + MIME consistency for a product file.
 * Returns the safe extension if valid, or null if rejected.
 *
 * Rejects:
 * - Dangerous extensions (.exe, .js, .bat, etc.)
 * - Unsupported extensions (.rar, .7z, .doc, etc.)
 * - MIME/extension mismatch
 * - No extension
 */
export function getSafeExtension(
  fileName: string,
  mimeType: string,
): string | null {
  const ext = getFileExtension(fileName);

  // 1. Must have an extension
  if (!ext) return null;

  // 2. Must not be dangerous
  if (isDangerousExtension(fileName)) return null;

  // 3. Extension must be in allowed list
  const allowedMimes = ALLOWED_FILE_EXTENSIONS[ext];
  if (!allowedMimes) return null;

  // 4. MIME must match the extension's allowed MIMEs
  if (!allowedMimes.includes(mimeType)) return null;

  // Return extension without the dot (e.g., "docx", "zip")
  return ext.slice(1);
}

/**
 * Validate a product file completely: extension + MIME + size.
 * Returns an error message or null if valid.
 */
export function validateProductFile(
  fileName: string,
  mimeType: string,
  fileSize: number,
): string | null {
  if (isDangerousExtension(fileName)) {
    return "Định dạng file không được hỗ trợ.";
  }

  if (!isAllowedFileExtension(fileName)) {
    return "Chỉ hỗ trợ file DOCX và ZIP.";
  }

  if (!isAllowedProductFileType(mimeType)) {
    return "Chỉ hỗ trợ file DOCX và ZIP.";
  }

  const safeExt = getSafeExtension(fileName, mimeType);
  if (!safeExt) {
    return "Định dạng file không khớp. Vui lòng kiểm tra lại.";
  }

  if (fileSize > MAX_PRODUCT_FILE_SIZE) {
    return "Dung lượng file vượt quá 50 MB.";
  }

  return null;
}

// ─── Format Derivation ─────────────────────────────────────────────

/**
 * Derive the product file_format from actual filenames.
 * Returns "docx", "zip", or "mixed" based on the file extensions present.
 * Defaults to "docx" for empty arrays.
 */
export function deriveFileFormat(fileNames: string[]): string {
  if (fileNames.length === 0) return "docx";

  const extensions = new Set(
    fileNames.map((name) => {
      const ext = name.lastIndexOf(".");
      return ext !== -1 ? name.slice(ext + 1).toLowerCase() : "";
    }).filter(Boolean),
  );

  if (extensions.size === 0) return "docx";
  if (extensions.size === 1) return extensions.values().next().value!;
  return "mixed";
}
