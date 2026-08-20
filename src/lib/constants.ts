/**
 * Application-wide constants.
 */

/** Possible order statuses */
export const ORDER_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/**
 * Allowed MIME types for product files (private bucket).
 * V1 supports: DOCX and ZIP.
 */
export const ALLOWED_PRODUCT_FILE_MIMES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/zip", // .zip (standard)
  "application/x-zip-compressed", // .zip (Windows/legacy)
] as const;

/** @deprecated Use ALLOWED_PRODUCT_FILE_MIMES instead */
export const ALLOWED_MIME_TYPES = ALLOWED_PRODUCT_FILE_MIMES;

/**
 * Allowed file extensions for product files.
 * Maps extension (lowercase, with dot) to its valid MIME types.
 */
export const ALLOWED_FILE_EXTENSIONS: Record<string, readonly string[]> = {
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".zip": [
    "application/zip",
    "application/x-zip-compressed",
  ],
} as const;

/**
 * Dangerous file extensions that must ALWAYS be rejected,
 * even if renamed or MIME-spoofed.
 */
export const DANGEROUS_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".scr", ".com", ".pif",
  ".js", ".vbs", ".wsf", ".msi", ".ps1",
  ".rar", ".7z", // unsupported archive formats in V1
] as const;

/**
 * Maximum product file size: 50 MB.
 * Matches Supabase Free tier upload limit.
 */
export const MAX_PRODUCT_FILE_SIZE = 50 * 1024 * 1024;

/** Storage bucket names */
export const STORAGE_BUCKETS = {
  PRODUCT_FILES: "product-files",
  PRODUCT_ASSETS: "product-assets",
} as const;

/** Default pagination */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 50,
} as const;
