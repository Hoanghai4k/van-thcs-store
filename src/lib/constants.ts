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

/** Allowed file MIME types for product documents */
export const ALLOWED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
] as const;

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
