/**
 * Download token utilities.
 *
 * Generates and validates secure download tokens.
 * Tokens are random, time-limited, and have a maximum download count.
 */

import crypto from "crypto";
import { siteConfig } from "@/config/site";

/**
 * Generate a secure random download token.
 */
export function generateDownloadToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Calculate the expiration date for a new download token.
 */
export function getTokenExpiry(): Date {
  const now = new Date();
  now.setHours(now.getHours() + siteConfig.store.downloadTokenExpiryHours);
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
