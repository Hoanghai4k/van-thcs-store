/**
 * Upload session management for R2 multipart uploads.
 *
 * Uses HMAC-signed opaque tokens to bind an upload session to:
 *   - Admin user
 *   - Product ID
 *   - R2 object key
 *   - Upload ID
 *
 * This prevents a malicious client from completing arbitrary uploads.
 * Server-only module — NEVER import in client components.
 */

import { createHmac } from "crypto";

function getSigningSecret(): string {
  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("ADMIN_SECRET_KEY must be set (min 16 chars) for upload session signing.");
  }
  return secret;
}

export interface UploadSessionPayload {
  uploadId: string;
  objectKey: string;
  productId: string;
  totalParts: number;
  fileSize: number;
}

/**
 * Create an HMAC-signed session token for a multipart upload.
 * The token encodes the session metadata and a signature.
 */
export function signUploadSession(payload: UploadSessionPayload): string {
  const data = JSON.stringify(payload);
  const secret = getSigningSecret();
  const sig = createHmac("sha256", secret).update(data).digest("hex");
  const combined = Buffer.from(JSON.stringify({ data, sig })).toString("base64url");
  return combined;
}

/**
 * Verify and decode an upload session token.
 * Returns null if signature is invalid or token is malformed.
 */
export function verifyUploadSession(token: string): UploadSessionPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const { data, sig } = JSON.parse(decoded) as { data: string; sig: string };

    const secret = getSigningSecret();
    const expectedSig = createHmac("sha256", secret).update(data).digest("hex");

    // Constant-time comparison
    if (sig.length !== expectedSig.length) return null;
    let mismatch = 0;
    for (let i = 0; i < sig.length; i++) {
      mismatch |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    if (mismatch !== 0) return null;

    return JSON.parse(data) as UploadSessionPayload;
  } catch {
    return null;
  }
}
