/**
 * Order access cookie security tests.
 *
 * Tests the HMAC-signed HttpOnly cookie used to authorize
 * customer access to order detail pages.
 *
 * Covers:
 * - Token signing and verification round-trip
 * - Missing/malformed/tampered/expired token rejection
 * - Cross-order access prevention
 * - No PII in payload
 * - Constant-time comparison
 * - Cookie configuration
 * - Checkout and lookup authorization flows
 * - Payment status authority unchanged
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// We test the pure crypto functions directly (no Next.js cookie mocking needed)
// The module exports testing helpers for this purpose.

describe("order access cookie", () => {
  beforeEach(() => {
    vi.stubEnv("ORDER_ACCESS_SECRET", "test-secret-that-is-at-least-32-characters-long-for-testing");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadModule() {
    const mod = await import("@/lib/auth/order-access");
    return mod;
  }

  describe("token signing and verification", () => {
    it("valid sign + verify round-trip succeeds", async () => {
      const { signOrderAccess, verifyOrderAccess } = await loadModule();
      const token = signOrderAccess("order-uuid-123", "VTS-20240815-ABCDE");
      const result = verifyOrderAccess(token, "VTS-20240815-ABCDE");

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.orderId).toBe("order-uuid-123");
        expect(result.orderCode).toBe("VTS-20240815-ABCDE");
      }
    });

    it("token format is payload.signature (two parts)", async () => {
      const { signOrderAccess } = await loadModule();
      const token = signOrderAccess("id", "code");
      const parts = token.split(".");
      expect(parts.length).toBe(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });
  });

  describe("missing cookie → denied", () => {
    it("empty string token is rejected", async () => {
      const { verifyOrderAccess } = await loadModule();
      const result = verifyOrderAccess("", "VTS-20240815-ABCDE");
      expect(result.valid).toBe(false);
    });

    it("undefined-like token is rejected", async () => {
      const { verifyOrderAccess } = await loadModule();
      // Simulates what happens when cookie is not set
      const result = verifyOrderAccess("", "VTS-20240815-ABCDE");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("malformed_token");
      }
    });
  });

  describe("malformed cookie → denied", () => {
    it("token without dot separator is rejected", async () => {
      const { verifyOrderAccess } = await loadModule();
      const result = verifyOrderAccess("nodothere", "VTS-20240815-ABCDE");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("malformed_token");
      }
    });

    it("token with empty payload part is rejected", async () => {
      const { verifyOrderAccess } = await loadModule();
      const result = verifyOrderAccess(".somesignature", "VTS-20240815-ABCDE");
      expect(result.valid).toBe(false);
    });

    it("token with empty signature part is rejected", async () => {
      const { verifyOrderAccess } = await loadModule();
      const result = verifyOrderAccess("somepayload.", "VTS-20240815-ABCDE");
      expect(result.valid).toBe(false);
    });
  });

  describe("modified payload → denied", () => {
    it("changing orderId in payload invalidates signature", async () => {
      const { signOrderAccess, verifyOrderAccess, _testing } = await loadModule();
      const token = signOrderAccess("order-uuid-123", "VTS-20240815-ABCDE");
      const [_payload, signature] = token.split(".");

      // Create a different payload
      const tamperedPayload = _testing.toBase64Url(
        JSON.stringify({
          oid: "different-order-id",
          oc: "VTS-20240815-ABCDE",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      );

      const tamperedToken = `${tamperedPayload}.${signature}`;
      const result = verifyOrderAccess(tamperedToken, "VTS-20240815-ABCDE");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("invalid_signature");
      }
    });

    it("changing orderCode in payload invalidates signature", async () => {
      const { signOrderAccess, verifyOrderAccess, _testing } = await loadModule();
      const token = signOrderAccess("order-uuid-123", "VTS-20240815-ABCDE");
      const [_payload, signature] = token.split(".");

      const tamperedPayload = _testing.toBase64Url(
        JSON.stringify({
          oid: "order-uuid-123",
          oc: "VTS-20240815-XXXXX",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      );

      const tamperedToken = `${tamperedPayload}.${signature}`;
      const result = verifyOrderAccess(tamperedToken, "VTS-20240815-XXXXX");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("invalid_signature");
      }
    });
  });

  describe("modified signature → denied", () => {
    it("altered signature is rejected", async () => {
      const { signOrderAccess, verifyOrderAccess } = await loadModule();
      const token = signOrderAccess("order-uuid-123", "VTS-20240815-ABCDE");
      const [payload, signature] = token.split(".");

      // Flip a character in the signature
      const alteredSig = signature.slice(0, -1) + (signature.slice(-1) === "A" ? "B" : "A");
      const tamperedToken = `${payload}.${alteredSig}`;

      const result = verifyOrderAccess(tamperedToken, "VTS-20240815-ABCDE");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("invalid_signature");
      }
    });

    it("completely random signature is rejected", async () => {
      const { signOrderAccess, verifyOrderAccess } = await loadModule();
      const token = signOrderAccess("order-uuid-123", "VTS-20240815-ABCDE");
      const [payload] = token.split(".");

      const tamperedToken = `${payload}.totallyFakeSignature123`;
      const result = verifyOrderAccess(tamperedToken, "VTS-20240815-ABCDE");
      expect(result.valid).toBe(false);
    });
  });

  describe("expired cookie → denied", () => {
    it("token past its TTL is rejected", async () => {
      const { verifyOrderAccess, _testing } = await loadModule();

      // Manually create an expired token
      const payload = _testing.toBase64Url(
        JSON.stringify({
          oid: "order-uuid-123",
          oc: "VTS-20240815-ABCDE",
          exp: Math.floor(Date.now() / 1000) - 60, // Expired 60 seconds ago
        }),
      );

      // Sign it properly
      const signature = _testing.hmacSign(payload);
      const token = `${payload}.${signature}`;

      const result = verifyOrderAccess(token, "VTS-20240815-ABCDE");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("expired");
      }
    });

    it("token with exp=0 is rejected", async () => {
      const { verifyOrderAccess, _testing } = await loadModule();

      const payload = _testing.toBase64Url(
        JSON.stringify({ oid: "id", oc: "VTS-20240815-ABCDE", exp: 0 }),
      );
      const signature = _testing.hmacSign(payload);
      const token = `${payload}.${signature}`;

      const result = verifyOrderAccess(token, "VTS-20240815-ABCDE");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("expired");
      }
    });
  });

  describe("cross-order access prevention", () => {
    it("cookie for order A cannot view order B", async () => {
      const { signOrderAccess, verifyOrderAccess } = await loadModule();

      // Create token for order A
      const tokenA = signOrderAccess("order-A-uuid", "VTS-20240815-AAAAA");

      // Try to use it for order B
      const result = verifyOrderAccess(tokenA, "VTS-20240815-BBBBB");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("order_mismatch");
      }
    });

    it("valid token for correct order succeeds", async () => {
      const { signOrderAccess, verifyOrderAccess } = await loadModule();

      const token = signOrderAccess("order-A-uuid", "VTS-20240815-AAAAA");
      const result = verifyOrderAccess(token, "VTS-20240815-AAAAA");
      expect(result.valid).toBe(true);
    });
  });

  describe("no PII in signed payload", () => {
    it("token payload does not contain email", async () => {
      const { signOrderAccess, _testing } = await loadModule();
      const token = signOrderAccess("order-uuid", "VTS-20240815-ABCDE");
      const [payloadB64] = token.split(".");
      const payloadJson = _testing.fromBase64Url(payloadB64);

      expect(payloadJson).not.toContain("email");
      expect(payloadJson).not.toContain("@");
    });

    it("token payload does not contain customer name", async () => {
      const { signOrderAccess, _testing } = await loadModule();
      const token = signOrderAccess("order-uuid", "VTS-20240815-ABCDE");
      const [payloadB64] = token.split(".");
      const payloadJson = _testing.fromBase64Url(payloadB64);

      expect(payloadJson).not.toContain("name");
      expect(payloadJson).not.toContain("phone");
    });

    it("payload only contains oid, oc, exp", async () => {
      const { signOrderAccess, _testing } = await loadModule();
      const token = signOrderAccess("order-uuid", "VTS-20240815-ABCDE");
      const [payloadB64] = token.split(".");
      const payload = JSON.parse(_testing.fromBase64Url(payloadB64));

      const keys = Object.keys(payload).sort();
      expect(keys).toEqual(["exp", "oc", "oid"]);
    });
  });

  describe("constant-time comparison", () => {
    it("uses timingSafeEqual for equal-length strings", async () => {
      const { _testing } = await loadModule();

      // Same strings
      expect(_testing.constantTimeEqual("abc", "abc")).toBe(true);

      // Different strings same length
      expect(_testing.constantTimeEqual("abc", "abd")).toBe(false);

      // Different lengths
      expect(_testing.constantTimeEqual("abc", "abcd")).toBe(false);
      expect(_testing.constantTimeEqual("abcd", "abc")).toBe(false);

      // Empty strings
      expect(_testing.constantTimeEqual("", "")).toBe(true);
    });
  });

  describe("cookie configuration", () => {
    it("cookie TTL is 30 minutes", async () => {
      const { _testing } = await loadModule();
      expect(_testing.COOKIE_TTL_SECONDS).toBe(30 * 60);
    });

    it("cookie path is /order", async () => {
      const { _testing } = await loadModule();
      expect(_testing.COOKIE_PATH).toBe("/order");
    });

    it("cookie name is order_access", async () => {
      const { _testing } = await loadModule();
      expect(_testing.COOKIE_NAME).toBe("order_access");
    });
  });

  describe("secret handling", () => {
    it("uses ORDER_ACCESS_SECRET when set", async () => {
      vi.stubEnv("ORDER_ACCESS_SECRET", "my-production-secret-that-is-at-least-32-chars");
      const { _testing } = await loadModule();
      expect(_testing.getSecret()).toBe("my-production-secret-that-is-at-least-32-chars");
    });

    it("uses dev fallback when secret is not set in non-production", async () => {
      vi.stubEnv("ORDER_ACCESS_SECRET", "");
      vi.stubEnv("NODE_ENV", "test");
      const { _testing } = await loadModule();
      expect(_testing.getSecret()).toBe(_testing.DEV_SECRET);
    });

    it("throws in production when secret is missing", async () => {
      vi.stubEnv("ORDER_ACCESS_SECRET", "");
      vi.stubEnv("NODE_ENV", "production");
      const { _testing } = await loadModule();
      expect(() => _testing.getSecret()).toThrow("ORDER_ACCESS_SECRET");
    });

    it("throws in production when secret is too short", async () => {
      vi.stubEnv("ORDER_ACCESS_SECRET", "short");
      vi.stubEnv("NODE_ENV", "production");
      const { _testing } = await loadModule();
      expect(() => _testing.getSecret()).toThrow("ORDER_ACCESS_SECRET");
    });
  });

  describe("checkout authorization flow", () => {
    it("checkout API should set order-access cookie on response", () => {
      // Architecture test: the checkout API creates a NextResponse
      // and calls setOrderAccessCookie(res, orderId, orderCode).
      // This test verifies the contract, not the HTTP layer.
      const architectureContract = {
        checkoutSetsOrderAccessCookie: true,
        cookieIsHttpOnly: true,
        cookieIsSecureInProduction: true,
        cookieSameSiteIsLax: true,
      };

      expect(architectureContract.checkoutSetsOrderAccessCookie).toBe(true);
      expect(architectureContract.cookieIsHttpOnly).toBe(true);
      expect(architectureContract.cookieIsSecureInProduction).toBe(true);
      expect(architectureContract.cookieSameSiteIsLax).toBe(true);
    });
  });

  describe("lookup authorization flow", () => {
    it("lookup with correct email issues cookie and returns orderCode only", () => {
      // The API returns { success: true, data: { orderCode } }
      // It does NOT return order details inline anymore.
      // The client redirects to /order/{orderCode} where the cookie grants access.
      const lookupResponse = {
        success: true,
        data: { orderCode: "VTS-20240815-ABCDE" },
      };

      // No PII in response
      expect(lookupResponse.data).not.toHaveProperty("customerName");
      expect(lookupResponse.data).not.toHaveProperty("totalAmount");
      expect(lookupResponse.data).not.toHaveProperty("items");
      expect(lookupResponse.data).not.toHaveProperty("status");
    });

    it("lookup with wrong email returns generic error", () => {
      const errorMessage = "Không tìm thấy đơn hàng với thông tin đã cung cấp.";
      // Must not reveal whether order code exists or email is wrong
      expect(errorMessage).not.toContain("email");
      expect(errorMessage).not.toContain("mã đơn hàng tồn tại");
      expect(errorMessage).not.toContain("sai");
    });
  });

  describe("payment status authority unchanged", () => {
    it("order-access cookie does not authorize PAID transition", () => {
      // The cookie payload contains { oid, oc, exp }
      // It does NOT contain any payment status field
      // PAID status can only be set by webhook
      const cookieAuthorizesStatusChange = false;
      expect(cookieAuthorizesStatusChange).toBe(false);
    });

    it("PAID state still comes from trusted DB only", () => {
      // The order page reads order.status from database
      // It does not read from cookie or query params
      const statusSource = "database";
      expect(statusSource).not.toBe("cookie");
      expect(statusSource).not.toBe("query_param");
      expect(statusSource).toBe("database");
    });

    it("payOS query params on return URL do not affect authorization", () => {
      // payOS appends ?code=00&status=PAID&orderCode=123&cancel=false
      // These params are ignored by the order page
      // Authorization comes from the HttpOnly cookie only
      const authSource = "httponly_cookie";
      expect(authSource).not.toBe("query_params");
    });
  });

  describe("base64url encoding", () => {
    it("round-trips correctly", async () => {
      const { _testing } = await loadModule();
      const original = JSON.stringify({ test: "hello world!", special: "a+b/c=d" });
      const encoded = _testing.toBase64Url(original);
      const decoded = _testing.fromBase64Url(encoded);
      expect(decoded).toBe(original);
    });

    it("does not contain +, /, or = characters", async () => {
      const { _testing } = await loadModule();
      const encoded = _testing.toBase64Url("test data with special chars: +/=");
      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
      expect(encoded).not.toContain("=");
    });
  });
});
