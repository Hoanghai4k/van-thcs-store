/**
 * Delivery access cookie — HMAC-signed HttpOnly authorization.
 *
 * Authorizes a browser to DOWNLOAD files from a specific paid order.
 * This is SEPARATE from the Order Access Cookie (view-only).
 *
 * Token format: base64url(payload).base64url(signature)
 * Payload: { dtid: downloadTokenId, oid: orderId, exp: unixTimestamp }
 * Signature: HMAC-SHA256(payload, DELIVERY_ACCESS_SECRET)
 *
 * SECURITY:
 * - No PII in payload (no email, name, raw token, storage path)
 * - Constant-time signature comparison (crypto.timingSafeEqual)
 * - HttpOnly + Secure + SameSite=Lax
 * - Short TTL (60 minutes)
 * - Order Access Cookie alone CANNOT authorize downloads
 */

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// ─── Constants ─────────────────────────────────────────────────────

const COOKIE_NAME = "delivery_access";
const COOKIE_TTL_SECONDS = 60 * 60; // 60 minutes
const COOKIE_PATH = "/";

// Dev-only fallback secret (never used in production)
const DEV_SECRET = "dev-delivery-secret-not-for-production-use-32chars";

// ─── Secret Management ─────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.DELIVERY_ACCESS_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  if (isProduction) {
    console.error(
      "[DeliveryAccess] CRITICAL: DELIVERY_ACCESS_SECRET is missing or too short in production!",
    );
    throw new Error("DELIVERY_ACCESS_SECRET must be set in production (min 32 chars).");
  }

  if (process.env.NODE_ENV !== "test") {
    console.warn(
      "[DeliveryAccess] Using dev-only fallback secret. Set DELIVERY_ACCESS_SECRET for production.",
    );
  }
  return DEV_SECRET;
}

// ─── Token Signing ─────────────────────────────────────────────────

interface DeliveryAccessPayload {
  dtid: string; // download token ID
  oid: string;  // order ID
  exp: number;  // expiration unix timestamp
}

function sign(payload: DeliveryAccessPayload): string {
  const secret = getSecret();
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadStr).digest("base64url");
  return `${payloadStr}.${signature}`;
}

function verify(token: string, expectedOrderId: string): DeliveryAccessPayload | null {
  if (!token || !token.includes(".")) return null;

  const [payloadStr, signature] = token.split(".");
  if (!payloadStr || !signature) return null;

  // Recompute signature
  const secret = getSecret();
  const expectedSig = createHmac("sha256", secret).update(payloadStr).digest("base64url");

  // Constant-time comparison
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;

  try {
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  // Parse payload
  try {
    const payload: DeliveryAccessPayload = JSON.parse(
      Buffer.from(payloadStr, "base64url").toString("utf8"),
    );

    // Check expiration
    if (!payload.exp || Date.now() / 1000 > payload.exp) return null;

    // Check order ownership
    if (payload.oid !== expectedOrderId) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Cookie Operations ─────────────────────────────────────────────

/**
 * Create a signed delivery access token.
 */
export function signDeliveryAccess(downloadTokenId: string, orderId: string): string {
  const payload: DeliveryAccessPayload = {
    dtid: downloadTokenId,
    oid: orderId,
    exp: Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS,
  };
  return sign(payload);
}

/**
 * Set the delivery access cookie on a NextResponse.
 */
export function setDeliveryAccessCookie(
  response: NextResponse,
  downloadTokenId: string,
  orderId: string,
): void {
  const token = signDeliveryAccess(downloadTokenId, orderId);
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
 * Set the delivery access cookie via Next.js cookies() API (Server Actions).
 */
export async function setDeliveryAccessCookieServerAction(
  downloadTokenId: string,
  orderId: string,
): Promise<void> {
  const token = signDeliveryAccess(downloadTokenId, orderId);
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
 * Read and verify the delivery access cookie.
 * Returns the payload if valid for the given orderId.
 */
export async function getDeliveryAccessCookie(
  orderId: string,
): Promise<{ downloadTokenId: string; orderId: string } | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie?.value) return null;

    const payload = verify(cookie.value, orderId);
    if (!payload) return null;

    return {
      downloadTokenId: payload.dtid,
      orderId: payload.oid,
    };
  } catch {
    return null;
  }
}

// ─── Testing Exports ───────────────────────────────────────────────

export const _testing = {
  COOKIE_NAME,
  COOKIE_TTL_SECONDS,
  COOKIE_PATH,
  DEV_SECRET,
  getSecret,
  sign,
  verify,
} as const;
