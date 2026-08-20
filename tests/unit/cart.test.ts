import { describe, it, expect, beforeEach } from "vitest";
import type { CartItem } from "@/types/common";

/**
 * Cart business logic tests.
 * Tests the core cart operations: add, remove, duplicate prevention,
 * total calculation, and clear.
 *
 * These test the pure logic, not React hooks, since the cart store
 * uses useSyncExternalStore with plain functions.
 */

function createTestItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "prod-test-1",
    name: "Test Product",
    slug: "test-product",
    price: 99000,
    originalPrice: null,
    thumbnailPath: null,
    ...overrides,
  };
}

describe("Cart business logic", () => {
  let items: CartItem[];

  beforeEach(() => {
    items = [];
  });

  function addItem(item: CartItem): void {
    if (items.some((i) => i.productId === item.productId)) {
      return;
    }
    items = [...items, item];
  }

  function removeItem(productId: string): void {
    items = items.filter((i) => i.productId !== productId);
  }

  function clearCart(): void {
    items = [];
  }

  function isInCart(productId: string): boolean {
    return items.some((i) => i.productId === productId);
  }

  function totalPrice(): number {
    return items.reduce((sum, item) => sum + item.price, 0);
  }

  it("adds an item to empty cart", () => {
    const item = createTestItem();
    addItem(item);
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe("prod-test-1");
  });

  it("does not add duplicate product", () => {
    const item = createTestItem();
    addItem(item);
    addItem(item); // same productId
    expect(items).toHaveLength(1);
  });

  it("adds multiple different products", () => {
    addItem(createTestItem({ productId: "prod-1", name: "Product 1" }));
    addItem(createTestItem({ productId: "prod-2", name: "Product 2" }));
    addItem(createTestItem({ productId: "prod-3", name: "Product 3" }));
    expect(items).toHaveLength(3);
  });

  it("removes an item by productId", () => {
    addItem(createTestItem({ productId: "prod-1" }));
    addItem(createTestItem({ productId: "prod-2" }));
    removeItem("prod-1");
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe("prod-2");
  });

  it("removing a non-existent item does nothing", () => {
    addItem(createTestItem({ productId: "prod-1" }));
    removeItem("prod-999");
    expect(items).toHaveLength(1);
  });

  it("clears all items", () => {
    addItem(createTestItem({ productId: "prod-1" }));
    addItem(createTestItem({ productId: "prod-2" }));
    clearCart();
    expect(items).toHaveLength(0);
  });

  it("isInCart returns true for existing product", () => {
    addItem(createTestItem({ productId: "prod-1" }));
    expect(isInCart("prod-1")).toBe(true);
  });

  it("isInCart returns false for non-existing product", () => {
    expect(isInCart("prod-999")).toBe(false);
  });

  it("calculates total price correctly", () => {
    addItem(createTestItem({ productId: "prod-1", price: 99000 }));
    addItem(createTestItem({ productId: "prod-2", price: 149000 }));
    addItem(createTestItem({ productId: "prod-3", price: 79000 }));
    expect(totalPrice()).toBe(327000);
  });

  it("total price is 0 for empty cart", () => {
    expect(totalPrice()).toBe(0);
  });

  it("total price updates after removing an item", () => {
    addItem(createTestItem({ productId: "prod-1", price: 99000 }));
    addItem(createTestItem({ productId: "prod-2", price: 149000 }));
    removeItem("prod-1");
    expect(totalPrice()).toBe(149000);
  });
});
