/**
 * Download service.
 *
 * Handles download token validation and file delivery.
 *
 * Validation checks (in order):
 * 1. Token exists
 * 2. Token has not expired
 * 3. Order associated with the token has PAID status
 * 4. Product belongs to the order
 * 5. Download count has not exceeded the maximum
 *
 * Only after ALL checks pass does the service generate a signed URL
 * for the customer to download the file.
 */

import { isTokenExpired, isDownloadLimitReached } from "./token";
import type { DownloadValidationResult } from "./types";

/**
 * Validate a download token and return file information if valid.
 *
 * TODO: Implement with Supabase when configured.
 * The implementation should:
 * 1. Query download_tokens table by token
 * 2. Check expiration
 * 3. Join with orders to verify PAID status
 * 4. Join with order_items to verify product belongs to order
 * 5. Join with product_files to get storage_path
 * 6. Check download count
 * 7. Increment download_count and update last_download_at
 * 8. Generate a signed URL from Supabase Storage
 */
export async function validateAndGetDownload(
  token: string,
): Promise<DownloadValidationResult> {
  // Placeholder validation
  if (!token || token.length < 10) {
    return { valid: false, error: "Token không hợp lệ" };
  }

  // TODO: Query database for token
  // For now, return invalid since no database is configured
  return {
    valid: false,
    error: "Hệ thống download chưa được cấu hình. Vui lòng liên hệ hỗ trợ.",
  };
}

/**
 * Validate token data against business rules.
 * Used internally after fetching token from database.
 */
export function validateTokenData(tokenData: {
  expiresAt: string;
  downloadCount: number;
  maxDownloads: number;
  orderStatus: string;
}): { valid: boolean; error?: string } {
  if (isTokenExpired(tokenData.expiresAt)) {
    return { valid: false, error: "Link tải đã hết hạn" };
  }

  if (tokenData.orderStatus !== "PAID") {
    return { valid: false, error: "Đơn hàng chưa được thanh toán" };
  }

  if (isDownloadLimitReached(tokenData.downloadCount, tokenData.maxDownloads)) {
    return { valid: false, error: "Đã vượt quá số lượt tải cho phép" };
  }

  return { valid: true };
}
