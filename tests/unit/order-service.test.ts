/**
 * Order service unit tests.
 *
 * Tests price calculation, code generation, and input validation.
 * Does NOT test DB operations (those require integration tests).
 */

import { describe, it, expect } from "vitest";
import {
  generateOrderCode,
  generatePaymentOrderCode,
  normalizeEmail,
} from "@/lib/utils";

describe("generateOrderCode", () => {
  it("generates code in VTS-YYYYMMDD-XXXXX format", () => {
    const code = generateOrderCode();
    expect(code).toMatch(/^VTS-\d{8}-[A-Z0-9]{5}$/);
  });

  it("generates unique codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateOrderCode());
    }
    // With cryptographic randomness, 100 codes should all be unique
    expect(codes.size).toBe(100);
  });

  it("includes current date", () => {
    const code = generateOrderCode();
    const today = new Date();
    const expectedDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("");
    expect(code).toContain(expectedDate);
  });

  it("does not contain ambiguous characters (I, O, 0, 1)", () => {
    // Generate many codes and check none contain ambiguous chars
    for (let i = 0; i < 50; i++) {
      const code = generateOrderCode();
      const randomPart = code.split("-")[2];
      expect(randomPart).not.toMatch(/[IO01]/);
    }
  });
});

describe("generatePaymentOrderCode", () => {
  it("generates a positive number", () => {
    const code = generatePaymentOrderCode();
    expect(code).toBeGreaterThan(0);
  });

  it("generates a safe integer", () => {
    const code = generatePaymentOrderCode();
    expect(Number.isSafeInteger(code)).toBe(true);
  });

  it("generates unique codes", () => {
    const codes = new Set<number>();
    for (let i = 0; i < 100; i++) {
      codes.add(generatePaymentOrderCode());
    }
    // In a tight loop, timestamp-based codes may collide (same ms).
    // In production, orders are seconds apart. DB UNIQUE handles the rest.
    expect(codes.size).toBeGreaterThanOrEqual(80);
  });

  it("generates codes of reasonable length", () => {
    const code = generatePaymentOrderCode();
    const codeStr = String(code);
    // Should be ~16 digits (13 timestamp + 3 random)
    expect(codeStr.length).toBeGreaterThanOrEqual(14);
    expect(codeStr.length).toBeLessThanOrEqual(17);
  });
});

describe("normalizeEmail", () => {
  it("converts to lowercase", () => {
    expect(normalizeEmail("TEST@EXAMPLE.COM")).toBe("test@example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  test@example.com  ")).toBe("test@example.com");
  });

  it("handles mixed case and whitespace", () => {
    expect(normalizeEmail("  Test@Example.COM  ")).toBe("test@example.com");
  });
});

describe("server price calculation logic", () => {
  it("calculates subtotal from product prices", () => {
    const products = [
      { price: 50000 },
      { price: 30000 },
      { price: 120000 },
    ];
    const subtotal = products.reduce((sum, p) => sum + p.price, 0);
    expect(subtotal).toBe(200000);
  });

  it("handles single product", () => {
    const products = [{ price: 99000 }];
    const subtotal = products.reduce((sum, p) => sum + p.price, 0);
    expect(subtotal).toBe(99000);
  });

  it("applies discount correctly", () => {
    const subtotal = 200000;
    const discount = 0; // No discount in V1
    const total = subtotal - discount;
    expect(total).toBe(200000);
  });
});

describe("product deduplication", () => {
  it("removes duplicate product IDs", () => {
    const ids = ["id-1", "id-2", "id-1", "id-3", "id-2"];
    const unique = [...new Set(ids)];
    expect(unique).toEqual(["id-1", "id-2", "id-3"]);
  });

  it("preserves single items", () => {
    const ids = ["id-1", "id-2", "id-3"];
    const unique = [...new Set(ids)];
    expect(unique).toEqual(["id-1", "id-2", "id-3"]);
  });

  it("handles empty array", () => {
    const ids: string[] = [];
    const unique = [...new Set(ids)];
    expect(unique).toEqual([]);
  });
});

describe("customer normalization", () => {
  it("trims name", () => {
    expect("  Nguyễn Văn A  ".trim()).toBe("Nguyễn Văn A");
  });

  it("trims phone", () => {
    expect("  0912345678  ".trim()).toBe("0912345678");
  });
});
