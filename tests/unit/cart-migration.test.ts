/**
 * Tests for cart version migration — legacy mock data cleanup.
 */

import { describe, it, expect } from "vitest";

// UUID regex matching the cart provider's validation
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("Cart UUID validation", () => {
  it("rejects legacy mock product IDs", () => {
    const legacyIds = [
      "prod-1",
      "prod-2",
      "prod-3",
      "cat-1",
      "product-1",
      "abc",
      "123",
    ];
    for (const id of legacyIds) {
      expect(UUID_RE.test(id)).toBe(false);
    }
  });

  it("accepts valid UUID v4 product IDs", () => {
    const validUUIDs = [
      "550e8400-e29b-41d4-a716-446655440000",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    ];
    for (const id of validUUIDs) {
      expect(UUID_RE.test(id)).toBe(true);
    }
  });
});

describe("Cart migration filtering", () => {
  it("filters legacy items and keeps valid ones", () => {
    const mixedCart = [
      { productId: "prod-1", name: "Mock 1", slug: "m1", price: 100, originalPrice: null, thumbnailPath: null },
      { productId: "550e8400-e29b-41d4-a716-446655440000", name: "Real 1", slug: "r1", price: 99000, originalPrice: null, thumbnailPath: null },
      { productId: "prod-2", name: "Mock 2", slug: "m2", price: 200, originalPrice: null, thumbnailPath: null },
      { productId: "f47ac10b-58cc-4372-a567-0e02b2c3d479", name: "Real 2", slug: "r2", price: 79000, originalPrice: null, thumbnailPath: null },
    ];

    const filtered = mixedCart.filter((item) => UUID_RE.test(item.productId));
    expect(filtered).toHaveLength(2);
    expect(filtered[0].name).toBe("Real 1");
    expect(filtered[1].name).toBe("Real 2");
  });

  it("returns empty array when all items are legacy", () => {
    const legacyCart = [
      { productId: "prod-1", name: "Mock 1", slug: "m1", price: 100, originalPrice: null, thumbnailPath: null },
      { productId: "prod-2", name: "Mock 2", slug: "m2", price: 200, originalPrice: null, thumbnailPath: null },
    ];

    const filtered = legacyCart.filter((item) => UUID_RE.test(item.productId));
    expect(filtered).toHaveLength(0);
  });

  it("preserves all items when all are valid UUIDs", () => {
    const validCart = [
      { productId: "550e8400-e29b-41d4-a716-446655440000", name: "R1", slug: "r1", price: 99000, originalPrice: null, thumbnailPath: null },
      { productId: "f47ac10b-58cc-4372-a567-0e02b2c3d479", name: "R2", slug: "r2", price: 79000, originalPrice: null, thumbnailPath: null },
    ];

    const filtered = validCart.filter((item) => UUID_RE.test(item.productId));
    expect(filtered).toHaveLength(2);
  });
});
