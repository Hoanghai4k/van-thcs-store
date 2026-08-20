import { describe, it, expect } from "vitest";
import { checkoutSchema, orderLookupSchema, checkoutFormSchema } from "@/features/orders/schema";

describe("checkoutSchema", () => {
  it("validates valid checkout data", () => {
    const result = checkoutSchema.safeParse({
      customerName: "Nguyễn Văn A",
      customerEmail: "test@example.com",
      customerPhone: "0912345678",
      productIds: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = checkoutSchema.safeParse({
      customerName: "",
      customerEmail: "test@example.com",
      customerPhone: "0912345678",
      productIds: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = checkoutSchema.safeParse({
      customerName: "Test",
      customerEmail: "not-an-email",
      customerPhone: "0912345678",
      productIds: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(result.success).toBe(false);
  });

  it("normalizes email to lowercase", () => {
    const result = checkoutSchema.safeParse({
      customerName: "Test User",
      customerEmail: "TEST@Example.COM",
      customerPhone: "0912345678",
      productIds: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerEmail).toBe("test@example.com");
    }
  });

  it("rejects invalid phone (letters)", () => {
    const result = checkoutSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "abc",
      productIds: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty product list", () => {
    const result = checkoutSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "0912345678",
      productIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid product IDs", () => {
    const result = checkoutSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "0912345678",
      productIds: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });
});

describe("checkoutFormSchema (client-side)", () => {
  it("validates valid form data", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "Nguyễn Văn A",
      customerEmail: "test@example.com",
      customerPhone: "0912345678",
    });
    expect(result.success).toBe(true);
  });

  it("trims name whitespace", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "  Test User  ",
      customerEmail: "test@example.com",
      customerPhone: "0912345678",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerName).toBe("Test User");
    }
  });

  it("rejects name shorter than 2 characters", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "A",
      customerEmail: "test@example.com",
      customerPhone: "0912345678",
    });
    expect(result.success).toBe(false);
  });
});

describe("phone validation (Vietnamese format)", () => {
  it("accepts valid 10-digit VN phone", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "0912345678",
    });
    expect(result.success).toBe(true);
  });

  it("accepts phone starting with 03x", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "0381234567",
    });
    expect(result.success).toBe(true);
  });

  it("accepts phone starting with 05x", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "0561234567",
    });
    expect(result.success).toBe(true);
  });

  it("accepts +84 format", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "+84912345678",
    });
    expect(result.success).toBe(true);
  });

  it("strips spaces from phone before validation", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "091 234 5678",
    });
    expect(result.success).toBe(true);
  });

  it("rejects phone starting with 00, 01, 02", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "0112345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects too-short phone", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "091234",
    });
    expect(result.success).toBe(false);
  });

  it("rejects phone with letters", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "091abc5678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty phone", () => {
    const result = checkoutFormSchema.safeParse({
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("orderLookupSchema", () => {
  it("validates valid lookup data", () => {
    const result = orderLookupSchema.safeParse({
      orderCode: "VTS-20240101-ABC12",
      email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid order code format", () => {
    const result = orderLookupSchema.safeParse({
      orderCode: "INVALID-CODE",
      email: "test@example.com",
    });
    expect(result.success).toBe(false);
  });
});
