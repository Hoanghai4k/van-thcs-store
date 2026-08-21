import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/orders/request-access/route";
import { sendMyOrdersAccessEmail } from "@/features/emails/service";
import * as queries from "@/features/orders/queries";
import * as resendProvider from "@/features/emails/resend-provider";

vi.mock("@/features/orders/queries", () => ({
  hasOrdersForEmail: vi.fn(),
}));

vi.mock("@/features/emails/resend-provider", () => ({
  getEmailProvider: vi.fn(),
}));

describe("My Orders Regression Tests", () => {
  const mockSendEmail = vi.fn().mockResolvedValue({ success: true, messageId: "msg-123" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resendProvider.getEmailProvider).mockReturnValue({
      name: "resend",
      sendEmail: mockSendEmail,
    } as ReturnType<typeof resendProvider.getEmailProvider>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Order Lookup and Privacy", () => {
    it("unknown email -> provider NOT called, browser response identical", async () => {
      vi.mocked(queries.hasOrdersForEmail).mockResolvedValue(false);

      const req = new NextRequest("http://localhost/api/orders/request-access", {
        method: "POST",
        body: JSON.stringify({ email: "unknown@example.com" }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Nếu email này có đơn hàng, chúng tôi đã gửi liên kết xác minh.");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("known email -> provider called", async () => {
      vi.mocked(queries.hasOrdersForEmail).mockResolvedValue(true);

      const req = new NextRequest("http://localhost/api/orders/request-access", {
        method: "POST",
        body: JSON.stringify({ email: "known@example.com" }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Nếu email này có đơn hàng, chúng tôi đã gửi liên kết xác minh.");
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      
      const callArgs = mockSendEmail.mock.calls[0][0];
      expect(callArgs.to).toBe("known@example.com");
      expect(callArgs.html).not.toContain("known@example.com"); // raw email not included in magic URL
    });
  });

  describe("Idempotency", () => {
    it("email A and email B generate different idempotency keys", async () => {
      await sendMyOrdersAccessEmail("emailA@example.com", "tokenA");
      await sendMyOrdersAccessEmail("emailB@example.com", "tokenB");

      const call1 = mockSendEmail.mock.calls[0][0];
      const call2 = mockSendEmail.mock.calls[1][0];

      expect(call1.idempotencyKey).toBeDefined();
      expect(call2.idempotencyKey).toBeDefined();
      expect(call1.idempotencyKey).not.toBe(call2.idempotencyKey);
    });

    it("same email inside same bucket is safely deduplicated (generates same key)", async () => {
      const originalNow = Date.now;
      Date.now = vi.fn(() => 1000000000000); // fixed time

      await sendMyOrdersAccessEmail("test@example.com", "token1");
      await sendMyOrdersAccessEmail("test@example.com", "token2");

      const call1 = mockSendEmail.mock.calls[0][0];
      const call2 = mockSendEmail.mock.calls[1][0];

      expect(call1.idempotencyKey).toBe(call2.idempotencyKey);
      
      Date.now = originalNow;
    });

    it("same email in next time bucket can send again (generates different key)", async () => {
      const originalNow = Date.now;
      
      // Bucket 1
      Date.now = vi.fn(() => 1000000000000);
      await sendMyOrdersAccessEmail("test@example.com", "token1");
      
      // Bucket 2 (5 minutes later)
      Date.now = vi.fn(() => 1000000000000 + 5 * 60 * 1000 + 1000);
      await sendMyOrdersAccessEmail("test@example.com", "token2");

      const call1 = mockSendEmail.mock.calls[0][0];
      const call2 = mockSendEmail.mock.calls[1][0];

      expect(call1.idempotencyKey).not.toBe(call2.idempotencyKey);
      
      Date.now = originalNow;
    });
  });

  describe("Provider Results", () => {
    it("Resend error response handled as failure", async () => {
      mockSendEmail.mockResolvedValueOnce({ success: false, error: "API Key invalid" });

      const result = await sendMyOrdersAccessEmail("test@example.com", "token");
      expect(result.success).toBe(false);
      expect(result.error).toBe("API Key invalid");
    });

    it("Resend success recorded correctly", async () => {
      mockSendEmail.mockResolvedValueOnce({ success: true, messageId: "123" });

      const result = await sendMyOrdersAccessEmail("test@example.com", "token");
      expect(result.success).toBe(true);
    });
  });
});
