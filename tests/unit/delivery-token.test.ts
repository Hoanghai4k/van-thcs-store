/**
 * Delivery token tests — token generation and hashing.
 *
 * Tests cover:
 * - Random token generation (base64url)
 * - SHA-256 hash computation (deterministic)
 * - DB stores hash, not raw token
 * - Token helpers (expiry, limits)
 * - Delivery URL construction
 */

import { describe, it, expect } from "vitest";
import {
  generateDeliveryToken,
  hashToken,
  isTokenExpired,
  isDownloadLimitReached,
  getTokenExpiry,
  getMaxDownloads,
  buildDeliveryUrl,
} from "@/features/downloads/token";
import { createHash } from "crypto";

describe("delivery token generation", () => {
  it("generates a non-empty token", () => {
    const token = generateDeliveryToken();
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(20);
  });

  it("generates unique tokens each call", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateDeliveryToken()));
    expect(tokens.size).toBe(100);
  });

  it("generates URL-safe tokens (no +, /, =)", () => {
    for (let i = 0; i < 50; i++) {
      const token = generateDeliveryToken();
      expect(token).not.toMatch(/[+/=]/);
    }
  });

  it("generates base64url-encoded tokens", () => {
    const token = generateDeliveryToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("token hashing", () => {
  it("produces deterministic SHA-256 hash", () => {
    const raw = "test-token-12345";
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);
    expect(hash1).toBe(hash2);
  });

  it("hash is hex-encoded SHA-256", () => {
    const raw = "test-token-12345";
    const expected = createHash("sha256").update(raw).digest("hex");
    expect(hashToken(raw)).toBe(expected);
  });

  it("different tokens produce different hashes", () => {
    const hash1 = hashToken("token-a");
    const hash2 = hashToken("token-b");
    expect(hash1).not.toBe(hash2);
  });

  it("hash is 64 characters (SHA-256 hex)", () => {
    const hash = hashToken(generateDeliveryToken());
    expect(hash.length).toBe(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it("raw token cannot be recovered from hash", () => {
    const raw = generateDeliveryToken();
    const hash = hashToken(raw);
    // Hash should NOT contain the raw token
    expect(hash).not.toBe(raw);
    expect(hash).not.toContain(raw);
  });
});

describe("isTokenExpired", () => {
  it("returns false for future date", () => {
    const future = new Date();
    future.setHours(future.getHours() + 24);
    expect(isTokenExpired(future.toISOString())).toBe(false);
  });

  it("returns true for past date", () => {
    const past = new Date();
    past.setHours(past.getHours() - 1);
    expect(isTokenExpired(past.toISOString())).toBe(true);
  });

  it("accepts Date objects", () => {
    const past = new Date(Date.now() - 1000);
    expect(isTokenExpired(past)).toBe(true);
  });
});

describe("isDownloadLimitReached", () => {
  it("returns false when under limit", () => {
    expect(isDownloadLimitReached(2, 20)).toBe(false);
  });

  it("returns true when at limit", () => {
    expect(isDownloadLimitReached(20, 20)).toBe(true);
  });

  it("returns true when over limit", () => {
    expect(isDownloadLimitReached(21, 20)).toBe(true);
  });

  it("returns false at zero", () => {
    expect(isDownloadLimitReached(0, 20)).toBe(false);
  });
});

describe("getTokenExpiry", () => {
  it("returns a future date", () => {
    const expiry = getTokenExpiry();
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
  });

  it("expiry is approximately 30 days in the future", () => {
    const expiry = getTokenExpiry();
    const diff = expiry.getTime() - Date.now();
    const daysApprox = diff / (1000 * 60 * 60 * 24);
    expect(daysApprox).toBeGreaterThan(29);
    expect(daysApprox).toBeLessThanOrEqual(31);
  });
});

describe("getMaxDownloads", () => {
  it("returns a positive number", () => {
    expect(getMaxDownloads()).toBeGreaterThan(0);
  });

  it("returns 20 (default config)", () => {
    expect(getMaxDownloads()).toBe(20);
  });
});

describe("buildDeliveryUrl", () => {
  it("constructs correct URL", () => {
    const url = buildDeliveryUrl("abc123");
    expect(url).toContain("/delivery/abc123");
  });

  it("does not contain query params or fragments", () => {
    const url = buildDeliveryUrl("test-token");
    expect(url).not.toContain("?");
    expect(url).not.toContain("#");
  });
});
