import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateMagicLinkToken,
  verifyMagicLinkToken,
  signMyOrdersAccess,
  verifyMyOrdersAccess,
  _testing,
} from "@/lib/auth/my-orders-access";

describe("My Orders Crypto", () => {
  const EMAIL = "customer@example.com";

  beforeEach(() => {
    // Ensure standard dev secret is used
    process.env.MY_ORDERS_ACCESS_SECRET = "test-secret-at-least-32-chars-long-123";
  });

  describe("Magic Link Tokens (AES-256-GCM)", () => {
    it("should generate and verify a valid magic link token", () => {
      const token = generateMagicLinkToken(EMAIL);
      
      // Email should NOT be plaintext in the token
      expect(token).not.toContain(EMAIL);
      expect(token).not.toContain(Buffer.from(EMAIL).toString("base64"));
      
      const parts = token.split(".");
      expect(parts).toHaveLength(3); // iv.ciphertext.authtag

      const result = verifyMagicLinkToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.email).toBe(EMAIL);
      }
    });

    it("should reject tampered ciphertext", () => {
      const token = generateMagicLinkToken(EMAIL);
      const parts = token.split(".");
      
      // Corrupt ciphertext
      parts[1] = "A" + parts[1].substring(1);
      const tampered = parts.join(".");
      
      const result = verifyMagicLinkToken(tampered);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("decryption_failed");
      }
    });

    it("should reject expired magic link tokens", () => {
      vi.useFakeTimers();
      const token = generateMagicLinkToken(EMAIL);
      
      // Advance time beyond MAGIC_LINK_TTL_SECONDS (15 mins + 1s)
      vi.advanceTimersByTime(_testing.MAGIC_LINK_TTL_SECONDS * 1000 + 1000);
      
      const result = verifyMagicLinkToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("expired");
      }
      vi.useRealTimers();
    });
  });

  describe("My Orders Cookie (HMAC-SHA256)", () => {
    it("should generate and verify a valid cookie token", () => {
      const token = signMyOrdersAccess(EMAIL);
      
      const parts = token.split(".");
      expect(parts).toHaveLength(2); // payload.signature

      const result = verifyMyOrdersAccess(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.email).toBe(EMAIL);
      }
    });

    it("should reject a cookie with invalid signature", () => {
      const token = signMyOrdersAccess(EMAIL);
      const parts = token.split(".");
      
      // Tamper signature
      parts[1] = "A" + parts[1].substring(1);
      const tampered = parts.join(".");
      
      const result = verifyMyOrdersAccess(tampered);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("invalid_signature");
      }
    });

    it("should reject expired cookie tokens", () => {
      vi.useFakeTimers();
      const token = signMyOrdersAccess(EMAIL);
      
      // Advance time beyond COOKIE_TTL_SECONDS (30 mins + 1s)
      vi.advanceTimersByTime(_testing.COOKIE_TTL_SECONDS * 1000 + 1000);
      
      const result = verifyMyOrdersAccess(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("expired");
      }
      vi.useRealTimers();
    });
  });
});
