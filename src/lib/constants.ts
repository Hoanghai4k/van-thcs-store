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

/** Possible payment attempt statuses */
export const PAYMENT_ATTEMPT_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  FAILED: "FAILED",
} as const;

export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUS)[keyof typeof PAYMENT_ATTEMPT_STATUS];

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
 * Maximum product file size: 1 GB.
 * Must match R2 bucket / Supabase bucket limits.
 */
export const MAX_PRODUCT_FILE_SIZE = 1024 * 1024 * 1024;

/**
 * Large file warning threshold: 500 MB.
 * Files above this trigger an Admin-only warning.
 */
export const LARGE_FILE_WARNING_BYTES = 500 * 1024 * 1024;

/**
 * R2 multipart upload part size: 16 MiB.
 * R2 requires parts >= 5 MiB (except last). 16 MiB balances
 * throughput vs. memory for files up to 1 GB (~64 parts max).
 */
export const R2_PART_SIZE_BYTES = 16 * 1024 * 1024;

/**
 * R2 multipart upload concurrency: 3 parts in flight simultaneously.
 * Balances upload speed vs. browser memory/network pressure.
 */
export const R2_UPLOAD_CONCURRENCY = 3;

/**
 * Storage provider discriminator.
 * Matches product_files.storage_provider CHECK constraint.
 */
export const StorageProvider = {
  SUPABASE: "SUPABASE",
  R2: "R2",
} as const;
export type StorageProviderType = (typeof StorageProvider)[keyof typeof StorageProvider];

/** Storage bucket names (Supabase) */
export const STORAGE_BUCKETS = {
  PRODUCT_FILES: "product-files",
  PRODUCT_ASSETS: "product-assets",
  PRODUCT_PREVIEWS: "product-previews",
} as const;

/** Default pagination */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 50,
} as const;
