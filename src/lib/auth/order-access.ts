/**
 * Order access cookie — HMAC-signed HttpOnly authorization.
 *
 * Authorizes a browser to VIEW a specific order's details.
 * This does NOT authorize downloads, payment mutations, or any other action.
 *
 * Token format: base64url(payload).base64url(signature)
 * Payload: { oid: orderId, oc: orderCode, exp: unixTimestamp }
 * Signature: HMAC-SHA256(payload, ORDER_ACCESS_SECRET)
 *
 * SECURITY:
 * - No PII in payload (no email, name, phone)
 * - Constant-time signature comparison (crypto.timingSafeEqual)
 * - HttpOnly + Secure + SameSite=Lax
 * - Short TTL (30 minutes)
 * - Cookie does NOT authorize PAID status or file downloads
 */

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

// ─── Constants ─────────────────────────────────────────────────────

const COOKIE_NAME = "order_access";
const COOKIE_TTL_SECONDS = 30 * 60; // 30 minutes
const COOKIE_PATH = "/";

// ─── Types ─────────────────────────────────────────────────────────

interface OrderAccessPayload {
  /** Order UUID (internal) */
  oid: string;
  /** Human-readable order code (e.g., VTS-20240815-ABCDE) */
  oc: string;
  /** Expiry as Unix timestamp (seconds) */
  exp: number;
}

export interface OrderAccessResult {
  valid: true;
  orderId: string;
  orderCode: string;
}

export interface OrderAccessDenied {
  valid: false;
  reason: string;
}

export type OrderAccessVerification = OrderAccessResult | OrderAccessDenied;

// ─── Secret ────────────────────────────────────────────────────────

const DEV_SECRET = "dev-order-access-secret-do-not-use-in-production";

function getSecret(): string {
  const secret = process.env.ORDER_ACCESS_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }

  // Development fallback
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  if (isProduction) {
    console.error(
      "[OrderAccess] CRITICAL: ORDER_ACCESS_SECRET is missing or too short in production!",
    );
    throw new Error("ORDER_ACCESS_SECRET must be set in production (min 32 chars).");
  }

  if (process.env.NODE_ENV !== "test") {
    console.warn(
      "[OrderAccess] Using dev-only fallback secret. Set ORDER_ACCESS_SECRET for production.",
    );
  }
  return DEV_SECRET;
}

// ─── Token Creation ────────────────────────────────────────────────

/**
 * Create a signed order access token.
 *
 * @param orderId - The order's internal UUID
 * @param orderCode - The human-readable order code
 * @returns Signed token string: base64url(payload).base64url(signature)
 */
export function signOrderAccess(orderId: string, orderCode: string): string {
  const payload: OrderAccessPayload = {
    oid: orderId,
    oc: orderCode,
    exp: Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS,
  };

  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = hmacSign(payloadB64);
  return `${payloadB64}.${signature}`;
}

// ─── Token Verification ────────────────────────────────────────────

/**
 * Verify a signed order access token.
 *
 * @param token - The cookie value to verify
 * @param expectedOrderCode - The order code from the URL route param
 * @returns Verification result with orderId if valid
 */
export function verifyOrderAccess(
  token: string,
  expectedOrderCode: string,
): OrderAccessVerification {
  // 1. Check token format
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1 || dotIndex === 0 || dotIndex === token.length - 1) {
    return { valid: false, reason: "malformed_token" };
  }

  const payloadB64 = token.slice(0, dotIndex);
  const signatureB64 = token.slice(dotIndex + 1);

  // 2. Verify signature (constant-time)
  const expectedSignature = hmacSign(payloadB64);
  if (!constantTimeEqual(signatureB64, expectedSignature)) {
    return { valid: false, reason: "invalid_signature" };
  }

  // 3. Parse payload
  let payload: OrderAccessPayload;
  try {
    const json = fromBase64Url(payloadB64);
    payload = JSON.parse(json) as OrderAccessPayload;
  } catch {
    return { valid: false, reason: "invalid_payload" };
  }

  // 4. Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) {
    return { valid: false, reason: "expired" };
  }

  // 5. Check orderCode matches route
  if (payload.oc !== expectedOrderCode) {
    return { valid: false, reason: "order_mismatch" };
  }

  // 6. Validate required fields
  if (!payload.oid || !payload.oc) {
    return { valid: false, reason: "incomplete_payload" };
  }

  return {
    valid: true,
    orderId: payload.oid,
    orderCode: payload.oc,
  };
}

// ─── Cookie Operations ─────────────────────────────────────────────

/**
 * Set the order access cookie on a NextResponse.
 * Used by API routes (checkout, lookup) that return NextResponse.
 */
export function setOrderAccessCookie(
  response: NextResponse,
  orderId: string,
  orderCode: string,
): void {
  const token = signOrderAccess(orderId, orderCode);
  const isProduction = process.env.NODE_ENV === "production";

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: COOKIE_TTL_SECONDS,
  });
}

/**
 * Set the order access cookie using Next.js server cookies().
 * Used by Server Actions that don't return NextResponse.
 */
export async function setOrderAccessCookieFromServer(
  orderId: string,
  orderCode: string,
): Promise<void> {
  const token = signOrderAccess(orderId, orderCode);
  const isProduction = process.env.NODE_ENV === "production";
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: COOKIE_TTL_SECONDS,
  });
}

/**
 * Read and verify the order access cookie from the current request.
 * Used by Server Components to gate access.
 *
 * @param expectedOrderCode - The order code from the URL route param
 * @returns Verification result
 */
export async function getOrderAccessCookie(
  expectedOrderCode: string,
): Promise<OrderAccessVerification> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);

    if (!cookie?.value) {
      return { valid: false, reason: "no_cookie" };
    }

    return verifyOrderAccess(cookie.value, expectedOrderCode);
  } catch {
    return { valid: false, reason: "cookie_read_error" };
  }
}

// ─── Crypto Helpers ────────────────────────────────────────────────

function hmacSign(data: string): string {
  const secret = getSecret();
  const hmac = createHmac("sha256", secret);
  hmac.update(data);
  return toBase64Url(hmac.digest("base64"));
}

function constantTimeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function toBase64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  // Restore standard base64 padding
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

// ─── Exports for Testing ───────────────────────────────────────────

export const _testing = {
  COOKIE_NAME,
  COOKIE_TTL_SECONDS,
  COOKIE_PATH,
  DEV_SECRET,
  getSecret,
  hmacSign,
  constantTimeEqual,
  toBase64Url,
  fromBase64Url,
};
