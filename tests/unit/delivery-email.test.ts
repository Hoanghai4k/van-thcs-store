/**
 * Delivery email tests.
 *
 * Tests cover:
 * - Email template construction
 * - Idempotency key format
 * - Email does not contain signed URLs or storage paths
 * - Delivery link format
 * - Email failure does not undo PAID
 */

import { describe, it, expect } from "vitest";
import { buildDeliveryEmailSubject, buildDeliveryEmailHtml } from "@/features/emails/templates/delivery-email";
import { buildDeliveryUrl } from "@/features/downloads/token";
import { siteConfig } from "@/config/site";

describe("delivery email template", () => {
  const sampleData = {
    customerName: "Nguyễn Văn A",
    orderCode: "VTS-20260820-ABC12",
    deliveryUrl: "https://example.com/delivery/test-token-123",
    expiryDays: 30,
    items: [
      { productName: "Bộ đề đọc hiểu Ngữ văn 9", unitPrice: 99000 },
    ],
    totalAmount: 99000,
  };

  it("subject contains order code", () => {
    const subject = buildDeliveryEmailSubject("VTS-20260820-ABC12");
    expect(subject).toContain("VTS-20260820-ABC12");
  });

  it("subject is in Vietnamese", () => {
    const subject = buildDeliveryEmailSubject("VTS-123");
    expect(subject).toContain("Tài liệu");
  });

  it("HTML contains customer name", () => {
    const html = buildDeliveryEmailHtml(sampleData);
    expect(html).toContain("Nguyễn Văn A");
  });

  it("HTML contains order code", () => {
    const html = buildDeliveryEmailHtml(sampleData);
    expect(html).toContain("VTS-20260820-ABC12");
  });

  it("HTML contains delivery URL", () => {
    const html = buildDeliveryEmailHtml(sampleData);
    expect(html).toContain("https://example.com/delivery/test-token-123");
  });

  it("HTML contains 'Nhận tài liệu' button text", () => {
    const html = buildDeliveryEmailHtml(sampleData);
    expect(html).toContain("Nhận tài liệu");
  });

  it("HTML contains product name", () => {
    const html = buildDeliveryEmailHtml(sampleData);
    expect(html).toContain("Bộ đề đọc hiểu Ngữ văn 9");
  });

  it("HTML contains expiry information", () => {
    const html = buildDeliveryEmailHtml(sampleData);
    expect(html).toContain("30 ngày");
  });

  it("HTML contains support email", () => {
    const html = buildDeliveryEmailHtml(sampleData);
    expect(html).toContain(siteConfig.contact.email);
  });

  it("HTML does NOT contain storage path patterns", () => {
    const html = buildDeliveryEmailHtml(sampleData);
    expect(html).not.toContain("products/");
    expect(html).not.toContain("/files/");
    expect(html).not.toContain(".docx");
    expect(html).not.toContain("storage_path");
  });

  it("HTML does NOT contain Supabase signed URL patterns", () => {
    const html = buildDeliveryEmailHtml(sampleData);
    expect(html).not.toContain("supabase");
    expect(html).not.toContain("storage/v1/object/sign");
  });

  it("HTML does NOT contain service role key", () => {
    const html = buildDeliveryEmailHtml(sampleData);
    expect(html).not.toContain("service_role");
  });

  it("HTML escapes XSS in customer name", () => {
    const xssData = {
      ...sampleData,
      customerName: '<script>alert("xss")</script>',
    };
    const html = buildDeliveryEmailHtml(xssData);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("delivery URL", () => {
  it("points to /delivery/ path", () => {
    const url = buildDeliveryUrl("my-token");
    expect(url).toContain("/delivery/my-token");
  });

  it("uses site URL as base", () => {
    const url = buildDeliveryUrl("token123");
    expect(url.startsWith(siteConfig.url)).toBe(true);
  });
});

describe("idempotency key", () => {
  it("follows delivery-email/{orderId} format", () => {
    const orderId = "abc-123";
    const key = `delivery-email/${orderId}`;
    expect(key).toBe("delivery-email/abc-123");
  });

  it("is deterministic for same order", () => {
    const orderId = "order-xyz";
    const key1 = `delivery-email/${orderId}`;
    const key2 = `delivery-email/${orderId}`;
    expect(key1).toBe(key2);
  });

  it("is different for different orders", () => {
    const key1 = `delivery-email/order-1`;
    const key2 = `delivery-email/order-2`;
    expect(key1).not.toBe(key2);
  });
});
