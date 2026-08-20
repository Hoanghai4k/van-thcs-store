import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as requestAccessPost } from "@/app/api/orders/request-access/route";
import { GET as verifyGet } from "@/app/orders/verify/route";
import { POST as grantAccessPost } from "@/app/api/orders/grant-order-access/route";
import * as queries from "@/features/orders/queries";
import * as myOrdersAccess from "@/lib/auth/my-orders-access";
import * as emailService from "@/features/emails/service";
import * as orderAccess from "@/lib/auth/order-access";

vi.mock("@/features/orders/queries", () => ({
  hasOrdersForEmail: vi.fn(),
  getOrdersByEmail: vi.fn(),
}));

vi.mock("@/features/emails/service", () => ({
  sendMyOrdersAccessEmail: vi.fn(),
}));

vi.mock("@/lib/auth/my-orders-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/my-orders-access")>();
  return {
    ...actual,
    setMyOrdersAccessCookie: vi.fn(),
    getMyOrdersAccessCookie: vi.fn(),
  };
});

vi.mock("@/lib/auth/order-access", () => ({
  setOrderAccessCookie: vi.fn(),
}));

// Mock cookies for Next.js
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

describe("My Orders Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/orders/request-access", () => {
    it("should return generic response even if email does not exist (privacy preservation)", async () => {
      vi.mocked(queries.hasOrdersForEmail).mockResolvedValue(false);

      const req = new NextRequest("http://localhost/api/orders/request-access", {
        method: "POST",
        body: JSON.stringify({ email: "nonexistent@example.com" }),
      });

      const res = await requestAccessPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Nếu email này có đơn hàng, chúng tôi đã gửi liên kết xác minh.");
      expect(emailService.sendMyOrdersAccessEmail).not.toHaveBeenCalled();
    });

    it("should send email and return generic response if email exists", async () => {
      vi.mocked(queries.hasOrdersForEmail).mockResolvedValue(true);
      vi.mocked(emailService.sendMyOrdersAccessEmail).mockResolvedValue({ success: true });

      const req = new NextRequest("http://localhost/api/orders/request-access", {
        method: "POST",
        body: JSON.stringify({ email: "EXISTING@Example.com" }),
      });

      const res = await requestAccessPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe("Nếu email này có đơn hàng, chúng tôi đã gửi liên kết xác minh.");
      
      // Should normalize email before sending
      expect(emailService.sendMyOrdersAccessEmail).toHaveBeenCalledWith(
        "existing@example.com",
        expect.any(String)
      );
    });
  });

  describe("GET /orders/verify", () => {
    it("should reject missing token", async () => {
      const req = new NextRequest("http://localhost/orders/verify");
      const res = await verifyGet(req);
      
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain("Xác Minh Thất Bại");
    });

    it("should accept valid token, set cookie, and redirect to /orders", async () => {
      const token = myOrdersAccess.generateMagicLinkToken("user@example.com");
      const req = new NextRequest(`http://localhost/orders/verify?token=${token}`);
      
      const res = await verifyGet(req);
      
      // Should be a redirect
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost/orders");
      
      // Should have set the cookie
      expect(myOrdersAccess.setMyOrdersAccessCookie).toHaveBeenCalledWith(
        expect.anything(),
        "user@example.com"
      );
    });
  });

  describe("POST /api/orders/grant-order-access", () => {
    it("should deny access if no My Orders session exists", async () => {
      vi.mocked(myOrdersAccess.getMyOrdersAccessCookie).mockResolvedValue({
        valid: false,
        reason: "no_cookie",
      });

      const req = new NextRequest("http://localhost/api/orders/grant-order-access", {
        method: "POST",
        body: JSON.stringify({ orderCode: "VTS-123" }),
      });

      const res = await grantAccessPost(req);
      expect(res.status).toBe(401);
    });

    it("should deny access if user tries to open an order they don't own", async () => {
      vi.mocked(myOrdersAccess.getMyOrdersAccessCookie).mockResolvedValue({
        valid: true,
        email: "hacker@example.com",
      });
      // Mock db returns empty list for hacker
      vi.mocked(queries.getOrdersByEmail).mockResolvedValue([]);

      const req = new NextRequest("http://localhost/api/orders/grant-order-access", {
        method: "POST",
        body: JSON.stringify({ orderCode: "VTS-123" }), // Order belongs to someone else
      });

      const res = await grantAccessPost(req);
      expect(res.status).toBe(403);
      expect(orderAccess.setOrderAccessCookie).not.toHaveBeenCalled();
    });

    it("should grant access if user owns the order", async () => {
      vi.mocked(myOrdersAccess.getMyOrdersAccessCookie).mockResolvedValue({
        valid: true,
        email: "owner@example.com",
      });
      // Mock db returns the order
      vi.mocked(queries.getOrdersByEmail).mockResolvedValue([
        { id: "uuid-123", orderCode: "VTS-123" } as unknown as Awaited<ReturnType<typeof queries.getOrdersByEmail>>[0]
      ]);

      const req = new NextRequest("http://localhost/api/orders/grant-order-access", {
        method: "POST",
        body: JSON.stringify({ orderCode: "VTS-123" }),
      });

      const res = await grantAccessPost(req);
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.data.redirectUrl).toBe("/order/VTS-123");
      expect(orderAccess.setOrderAccessCookie).toHaveBeenCalledWith(
        expect.anything(),
        "uuid-123",
        "VTS-123"
      );
    });
  });
});
