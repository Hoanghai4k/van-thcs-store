/**
 * My Orders access cookie and magic link tokens.
 *
 * Provides cryptographic utilities for:
 * 1. Generating and verifying encrypted magic link tokens (AES-256-GCM).
 * 2. Creating and verifying HMAC-signed HttpOnly cookies for session access.
 *
 * SECURITY:
 * - Uses MY_ORDERS_ACCESS_SECRET (must be 32+ chars)
 * - Magic link payload is encrypted so PII (email) is not in URL
 * - Constant-time signature comparison for cookies
 * - HttpOnly + Secure + SameSite=Lax for cookies
 * - Magic link TTL: 15 minutes
 * - Cookie TTL: 30 minutes
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

// ─── Constants ─────────────────────────────────────────────────────

const COOKIE_NAME = "my_orders_access";
const COOKIE_TTL_SECONDS = 30 * 60; // 30 minutes
const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15 minutes
const COOKIE_PATH = "/";

// ─── Types ─────────────────────────────────────────────────────────

interface MagicLinkPayload {
  e: string; // Email
  exp: number; // Expiry timestamp (Unix seconds)
  jti: string; // Nonce to prevent replay if we ever add state (also adds entropy)
}

interface MyOrdersCookiePayload {
  e: string; // Email
  exp: number; // Expiry timestamp (Unix seconds)
}

export interface VerificationResult {
  valid: true;
  email: string;
}

export interface VerificationError {
  valid: false;
  reason: string;
}

export type VerificationResponse = VerificationResult | VerificationError;

// ─── Secret ────────────────────────────────────────────────────────

const DEV_SECRET = "dev-my-orders-access-secret-minimum-32-chars-long";

function getSecretKey(): Buffer {
  const secret = process.env.MY_ORDERS_ACCESS_SECRET;
  let secretString = secret;

  if (!secret || secret.length < 32) {
    const isProduction =
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production";

    if (isProduction) {
      console.error(
        "[MyOrdersAccess] CRITICAL: MY_ORDERS_ACCESS_SECRET is missing or < 32 chars in production!",
      );
      throw new Error(
        "MY_ORDERS_ACCESS_SECRET must be set in production (min 32 chars).",
      );
    }

    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[MyOrdersAccess] Using dev-only fallback secret. Set MY_ORDERS_ACCESS_SECRET for production.",
      );
    }
    secretString = DEV_SECRET;
  }

  // Ensure exactly 32 bytes for AES-256
  const buf = Buffer.from(secretString as string, "utf8");
  if (buf.length === 32) return buf;

  // Hash to exactly 32 bytes if the secret is not exactly 32 bytes
  const hash = createHmac("sha256", "key-derivation");
  hash.update(buf);
  return hash.digest();
}

// ─── Magic Link Encryption (AES-256-GCM) ───────────────────────────

/**
 * Encrypt an email into a short-lived magic link token.
 */
export function generateMagicLinkToken(email: string): string {
  const payload: MagicLinkPayload = {
    e: email,
    exp: Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS,
    jti: randomBytes(8).toString("hex"),
  };

  const plaintext = JSON.stringify(payload);
  const key = getSecretKey();
  const iv = randomBytes(12); // Standard GCM IV length

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: base64url(iv).base64url(ciphertext).base64url(authTag)
  return `${toBase64Url(iv)}.${toBase64Url(ciphertext)}.${toBase64Url(authTag)}`;
}

/**
 * Decrypt and verify a magic link token.
 */
export function verifyMagicLinkToken(token: string): VerificationResponse {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, reason: "malformed_token" };
    }

    const iv = fromBase64UrlToBuffer(parts[0]);
    const ciphertext = fromBase64UrlToBuffer(parts[1]);
    const authTag = fromBase64UrlToBuffer(parts[2]);

    if (iv.length !== 12 || authTag.length !== 16) {
      return { valid: false, reason: "invalid_token_format" };
    }

    const key = getSecretKey();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    const json = decrypted.toString("utf8");
    const payload = JSON.parse(json) as MagicLinkPayload;

    if (!payload.e || !payload.exp) {
      return { valid: false, reason: "invalid_payload" };
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return { valid: false, reason: "expired" };
    }

    return { valid: true, email: payload.e };
  } catch {
    return { valid: false, reason: "decryption_failed" };
  }
}

// ─── Cookie Signing (HMAC-SHA256) ──────────────────────────────────

/**
 * Create a signed cookie token for My Orders session.
 */
export function signMyOrdersAccess(email: string): string {
  const payload: MyOrdersCookiePayload = {
    e: email,
    exp: Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS,
  };

  const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(payload)));
  const signature = hmacSign(payloadB64);
  return `${payloadB64}.${signature}`;
}

/**
 * Verify a signed My Orders cookie token.
 */
export function verifyMyOrdersAccess(token: string): VerificationResponse {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1 || dotIndex === 0 || dotIndex === token.length - 1) {
    return { valid: false, reason: "malformed_token" };
  }

  const payloadB64 = token.slice(0, dotIndex);
  const signatureB64 = token.slice(dotIndex + 1);

  const expectedSignature = hmacSign(payloadB64);
  if (!constantTimeEqual(signatureB64, expectedSignature)) {
    return { valid: false, reason: "invalid_signature" };
  }

  let payload: MyOrdersCookiePayload;
  try {
    const json = fromBase64UrlToBuffer(payloadB64).toString("utf8");
    payload = JSON.parse(json) as MyOrdersCookiePayload;
  } catch {
    return { valid: false, reason: "invalid_payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) {
    return { valid: false, reason: "expired" };
  }

  if (!payload.e) {
    return { valid: false, reason: "incomplete_payload" };
  }

  return { valid: true, email: payload.e };
}

// ─── Cookie Operations ─────────────────────────────────────────────

export function setMyOrdersAccessCookie(
  response: NextResponse,
  email: string,
): void {
  const token = signMyOrdersAccess(email);
  const isProduction = process.env.NODE_ENV === "production";

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: COOKIE_TTL_SECONDS,
  });
}

export function clearMyOrdersAccessCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: 0,
  });
}

export async function clearMyOrdersAccessCookieFromServer(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: 0,
  });
}

export async function getMyOrdersAccessCookie(): Promise<VerificationResponse> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);

    if (!cookie?.value) {
      return { valid: false, reason: "no_cookie" };
    }

    return verifyMyOrdersAccess(cookie.value);
  } catch {
    return { valid: false, reason: "cookie_read_error" };
  }
}

// ─── Crypto Helpers ────────────────────────────────────────────────

function hmacSign(data: string): string {
  const key = getSecretKey();
  const hmac = createHmac("sha256", key);
  hmac.update(data);
  return toBase64Url(hmac.digest());
}

function constantTimeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function toBase64Url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64UrlToBuffer(input: string): Buffer {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  return Buffer.from(b64, "base64");
}

// ─── Exports for Testing ───────────────────────────────────────────

export const _testing = {
  COOKIE_NAME,
  COOKIE_TTL_SECONDS,
  MAGIC_LINK_TTL_SECONDS,
  DEV_SECRET,
  getSecretKey,
  hmacSign,
  constantTimeEqual,
  toBase64Url,
  fromBase64UrlToBuffer,
};
