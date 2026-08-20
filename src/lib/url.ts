/**
 * Centralized site URL helper.
 *
 * Returns the canonical site URL for use in server-side code
 * (payment return/cancel URLs, webhook registration, etc.).
 *
 * Priority:
 * 1. SITE_URL — explicit production URL (recommended for Vercel Production env)
 * 2. NEXT_PUBLIC_SITE_URL — legacy/client-side URL
 * 3. VERCEL_URL — auto-set by Vercel (format: <project>.vercel.app, no protocol)
 * 4. localhost fallback — development only
 *
 * SECURITY:
 * - Never trusts arbitrary Host headers for payment URLs
 * - VERCEL_URL is set by Vercel infrastructure, not user input
 * - Production deployments should always set SITE_URL explicitly
 */

/**
 * Get the canonical site URL for server-side use.
 *
 * Returns a full URL with protocol (https:// in production, http:// for localhost).
 * Trailing slashes are stripped.
 */
export function getSiteUrl(): string {
  // 1. Explicit server-side SITE_URL (highest priority)
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/+$/, "");
  }

  // 2. Legacy NEXT_PUBLIC_SITE_URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }

  // 3. Vercel auto-set URL (no protocol prefix)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Development fallback
  return "http://localhost:3000";
}
