import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/orders/resume-payment/route";
import { NextRequest } from "next/server";
import { PAYMENT_ATTEMPT_STATUS, ORDER_STATUS } from "@/lib/constants";
import * as adminSupa from "@/lib/supabase/admin";
import * as paymentService from "@/features/payments/payment-service";
import * as orderAccess from "@/lib/auth/order-access";

vi.mock("@/lib/supabase/admin");
vi.mock("@/features/payments/payment-service");
vi.mock("@/lib/auth/order-access");
vi.mock("@/features/orders/order-service", () => ({
  generateUniquePaymentOrderCode: vi.fn().mockResolvedValue(999999),
}));
vi.mock("@/lib/url", () => ({
  getSiteUrl: () => "http://localhost:3000",
}));

describe("Resume Payment API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(paymentService.getProviderName).mockReturnValue("payos");
    vi.mocked(orderAccess.getOrderAccessCookie).mockResolvedValue({
      valid: true,
      orderId: "order-1",
      orderCode: "VTS-1",
    });
  });

  function createRequest(body: Record<string, unknown> = { orderCode: "VTS-1" }) {
    return new NextRequest("http://localhost/api", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  function mockSupabase(
    orderData: Record<string, unknown> | null = null,
    activeAttemptData: Record<string, unknown> | null = null,
    updateMock = vi.fn(),
    insertMock = vi.fn()
  ) {
    const eqChain: Record<string, unknown> = {
      eq: () => eqChain,
      in: () => eqChain,
      single: vi.fn().mockResolvedValue({ data: orderData, error: orderData ? null : { message: "Not found" } }),
      maybeSingle: vi.fn().mockResolvedValue({ data: activeAttemptData, error: null }),
    };
    
    const client = {
      from: vi.fn(() => {
        return {
          select: vi.fn().mockReturnValue(eqChain),
          update: updateMock.mockReturnValue(eqChain),
          insert: insertMock.mockReturnValue({ error: null }),
        };
      }),
    };
    
    vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(client as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>);
  }

  it("PAID cannot retry", async () => {
    mockSupabase({ status: ORDER_STATUS.PAID, customer: { name: "x", email: "x", phone: "x" }, items: [] });
    const res = await POST(createRequest());
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("Đơn hàng đã được thanh toán.");
  });

  it("REFUNDED cannot retry", async () => {
    mockSupabase({ status: ORDER_STATUS.REFUNDED, customer: { name: "x", email: "x", phone: "x" }, items: [] });
    const res = await POST(createRequest());
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("Đơn hàng không thể thanh toán.");
  });

  it("valid PENDING attempt is reused", async () => {
    mockSupabase(
      { status: ORDER_STATUS.PENDING, total_amount: 100, customer: { name: "x", email: "x", phone: "x" }, items: [] },
      { id: "attempt-1", status: PAYMENT_ATTEMPT_STATUS.PENDING, provider_order_code: 111, checkout_url: "url-1", expires_at: new Date(Date.now() + 10000).toISOString() }
    );
    vi.mocked(paymentService.getPaymentStatus).mockResolvedValue({ found: true, status: PAYMENT_ATTEMPT_STATUS.PENDING });
    
    const res = await POST(createRequest());
    const json = await res.json();
    
    expect(res.status).toBe(200);
    expect(json.data.checkoutUrl).toBe("url-1");
    // Should not have called createPayment
    expect(paymentService.createPayment).not.toHaveBeenCalled();
  });

  it("expired link creates new attempt", async () => {
    const updateMock = vi.fn();
    const insertMock = vi.fn();
    mockSupabase(
      { id: "o-1", order_code: "VTS-1", status: ORDER_STATUS.PENDING, total_amount: 100, customer: { name: "x", email: "x", phone: "x" }, items: [] },
      { id: "attempt-1", status: PAYMENT_ATTEMPT_STATUS.PENDING, provider_order_code: 111, checkout_url: "url-1", expires_at: new Date(Date.now() - 10000).toISOString() },
      updateMock,
      insertMock
    );
    
    // provider reports EXPIRED or we consider it expired by time
    vi.mocked(paymentService.getPaymentStatus).mockResolvedValue({ found: true, status: PAYMENT_ATTEMPT_STATUS.EXPIRED });
    vi.mocked(paymentService.createPayment).mockResolvedValue({ success: true, checkoutUrl: "new-url", paymentLinkId: "pid" });
    
    const res = await POST(createRequest());
    const json = await res.json();
    
    expect(res.status).toBe(200);
    expect(json.data.checkoutUrl).toBe("new-url");
    
    // We updated the old attempt to EXPIRED
    expect(updateMock).toHaveBeenCalled();
    // We inserted a new attempt
    expect(insertMock).toHaveBeenCalled();
    const insertArgs = insertMock.mock.calls[0][0];
    expect(insertArgs.provider_order_code).toBe(999999); // different from old
    expect(insertArgs.status).toBe(PAYMENT_ATTEMPT_STATUS.PENDING);
    expect(insertArgs.amount).toBe(100); // from DB
  });

  it("cancelled link creates new attempt", async () => {
    const updateMock = vi.fn();
    mockSupabase(
      { id: "o-1", order_code: "VTS-1", status: ORDER_STATUS.PENDING, total_amount: 100, customer: { name: "x", email: "x", phone: "x" }, items: [] },
      { id: "attempt-1", status: PAYMENT_ATTEMPT_STATUS.PENDING, provider_order_code: 111, checkout_url: "url-1", expires_at: new Date(Date.now() + 10000).toISOString() },
      updateMock
    );
    
    // provider reports CANCELLED
    vi.mocked(paymentService.getPaymentStatus).mockResolvedValue({ found: true, status: PAYMENT_ATTEMPT_STATUS.CANCELLED });
    vi.mocked(paymentService.createPayment).mockResolvedValue({ success: true, checkoutUrl: "new-url" });
    
    const res = await POST(createRequest());
    
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalled();
    expect(paymentService.createPayment).toHaveBeenCalled();
  });
});
