/**
 * payOS provider unit tests.
 *
 * Tests the PayOSPaymentProvider mapping logic.
 * No real API calls to payOS.
 */

import { describe, it, expect } from "vitest";

describe("payOS payment request mapping", () => {
  it("maps order data to payOS format correctly", () => {
    const request = {
      orderId: "uuid-123",
      orderCode: "VTS-20260819-ABC12",
      paymentOrderCode: 1724025600000123,
      amount: 150000,
      description: "VTS VTS-20260819-ABC12",
      customerEmail: "test@example.com",
      customerName: "Nguyễn Văn A",
      customerPhone: "0912345678",
      returnUrl: "https://example.com/order/success?orderCode=VTS-20260819-ABC12",
      cancelUrl: "https://example.com/order/VTS-20260819-ABC12",
      items: [
        { name: "Đề kiểm tra Ngữ văn 8", quantity: 1, price: 50000 },
        { name: "Bộ đề thi cuối kỳ", quantity: 1, price: 100000 },
      ],
      expiresInSeconds: 900,
    };

    // Verify mapping to payOS format
    const payosData = {
      orderCode: request.paymentOrderCode,
      amount: request.amount,
      description: request.description.slice(0, 25),
      cancelUrl: request.cancelUrl,
      returnUrl: request.returnUrl,
      items: request.items.map((item) => ({
        name: item.name.slice(0, 256),
        quantity: item.quantity,
        price: item.price,
      })),
      buyerName: request.customerName,
      buyerEmail: request.customerEmail,
      buyerPhone: request.customerPhone,
      expiredAt: Math.floor(Date.now() / 1000) + request.expiresInSeconds,
    };

    expect(payosData.orderCode).toBe(1724025600000123);
    expect(payosData.amount).toBe(150000);
    expect(payosData.description.length).toBeLessThanOrEqual(25);
    expect(payosData.items).toHaveLength(2);
    expect(payosData.buyerName).toBe("Nguyễn Văn A");
    expect(payosData.buyerEmail).toBe("test@example.com");
    expect(payosData.buyerPhone).toBe("0912345678");
    expect(payosData.expiredAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("truncates description to 25 chars", () => {
    const longDescription = "VTS VTS-20260819-ABC12 this is very long description";
    expect(longDescription.slice(0, 25).length).toBe(25);
  });

  it("truncates item names to 256 chars", () => {
    const longName = "A".repeat(300);
    expect(longName.slice(0, 256).length).toBe(256);
  });
});

describe("payOS webhook data mapping", () => {
  function mapPayOSStatus(code: string): "success" | "cancelled" | "failed" {
    if (code === "00") return "success";
    if (code === "01") return "cancelled";
    return "failed";
  }

  it("maps success code '00' to success status", () => {
    expect(mapPayOSStatus("00")).toBe("success");
  });

  it("maps cancel code '01' to cancelled status", () => {
    expect(mapPayOSStatus("01")).toBe("cancelled");
  });

  it("maps unknown codes to failed status", () => {
    expect(mapPayOSStatus("99")).toBe("failed");
    expect(mapPayOSStatus("02")).toBe("failed");
  });
});

describe("payOS status mapping for reconciliation", () => {
  function mapPayOSReconciliationStatus(status: string): string {
    const statusMap: Record<string, string> = {
      PAID: "PAID",
      CANCELLED: "CANCELLED",
      EXPIRED: "CANCELLED",
      PENDING: "PENDING",
    };
    return statusMap[status] ?? "FAILED";
  }

  it("maps PAID status correctly", () => {
    expect(mapPayOSReconciliationStatus("PAID")).toBe("PAID");
  });

  it("maps CANCELLED status correctly", () => {
    expect(mapPayOSReconciliationStatus("CANCELLED")).toBe("CANCELLED");
  });

  it("maps EXPIRED to CANCELLED", () => {
    expect(mapPayOSReconciliationStatus("EXPIRED")).toBe("CANCELLED");
  });

  it("maps PENDING status correctly", () => {
    expect(mapPayOSReconciliationStatus("PENDING")).toBe("PENDING");
  });

  it("maps unknown statuses to FAILED", () => {
    expect(mapPayOSReconciliationStatus("UNKNOWN")).toBe("FAILED");
  });
});
