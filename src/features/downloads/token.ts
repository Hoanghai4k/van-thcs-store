/**
 * Delivery token utilities.
 *
 * Generates cryptographically secure delivery tokens and
 * computes SHA-256 hashes for storage.
 *
 * SECURITY:
 * - Raw tokens use crypto.randomBytes(32) → base64url (URL-safe)
 * - Only the SHA-256 hash is stored in the database
 * - Raw tokens exist only at generation time and in the delivery email URL
 * - Raw tokens must NEVER be logged
 */

import { createHash, randomBytes } from "crypto";
import { siteConfig } from "@/config/site";

/**
 * Generate a cryptographically secure delivery token.
 * Returns base64url-encoded string (URL-safe, no padding).
 */
export function generateDeliveryToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Compute SHA-256 hash of a raw token for database storage.
 * This is a one-way operation — the raw token cannot be recovered.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Calculate the expiration date for a new delivery token.
 */
export function getTokenExpiry(): Date {
  const now = new Date();
  now.setDate(now.getDate() + siteConfig.store.deliveryTokenExpiryDays);
  return now;
}

/**
 * Get the maximum number of downloads per token.
 */
export function getMaxDownloads(): number {
  return siteConfig.store.maxDownloadsPerToken;
}

/**
 * Check if a token has expired.
 */
export function isTokenExpired(expiresAt: string | Date): boolean {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return new Date() > expiry;
}

/**
 * Check if a token has exceeded its download limit.
 */
export function isDownloadLimitReached(
  downloadCount: number,
  maxDownloads: number,
): boolean {
  return downloadCount >= maxDownloads;
}

/**
 * Build the delivery URL for email.
 */
export function buildDeliveryUrl(rawToken: string): string {
  return `${siteConfig.url}/delivery/${rawToken}`;
}
