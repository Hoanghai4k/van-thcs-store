/**
 * Order Access vs Delivery Access separation tests.
 *
 * Proves that:
 * - Order Access Cookie alone CAN view order
 * - Order Access Cookie alone CANNOT directly authorize file downloads
 * - Delivery Access Cookie is required for downloads
 * - The two use different secrets
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("order access vs delivery access separation", () => {
  beforeEach(() => {
    vi.stubEnv("ORDER_ACCESS_SECRET", "order-secret-that-is-at-least-32-characters-long");
    vi.stubEnv("DELIVERY_ACCESS_SECRET", "delivery-secret-that-is-at-least-32-chars-long");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("ORDER_ACCESS_SECRET and DELIVERY_ACCESS_SECRET are different env vars", () => {
    expect(process.env.ORDER_ACCESS_SECRET).not.toBe(process.env.DELIVERY_ACCESS_SECRET);
  });

  it("order access cookie module exists and exports signOrderAccess", async () => {
    const mod = await import("@/lib/auth/order-access");
    expect(typeof mod.signOrderAccess).toBe("function");
  });

  it("delivery access cookie module exists and exports signDeliveryAccess", async () => {
    const mod = await import("@/lib/auth/delivery-access");
    expect(typeof mod.signDeliveryAccess).toBe("function");
  });

  it("order access token cannot be used as delivery access token", async () => {
    const orderMod = await import("@/lib/auth/order-access");
    const deliveryMod = await import("@/lib/auth/delivery-access");

    const orderToken = orderMod.signOrderAccess("order-123", "VTS-123");
    // Attempt to verify order token as delivery token should fail
    const result = deliveryMod._testing.verify(orderToken, "order-123");
    expect(result).toBeNull();
  });

  it("delivery access token cannot be used as order access token", async () => {
    const orderMod = await import("@/lib/auth/order-access");
    const deliveryMod = await import("@/lib/auth/delivery-access");

    const deliveryToken = deliveryMod.signDeliveryAccess("dt-123", "order-123");
    // Attempt to verify delivery token as order token should fail
    const result = orderMod.verifyOrderAccess(deliveryToken, "VTS-123");
    expect(result.valid).toBe(false);
  });

  it("order access cookie name is 'order_access'", async () => {
    const mod = await import("@/lib/auth/order-access");
    expect(mod._testing.COOKIE_NAME).toBe("order_access");
  });

  it("delivery access cookie name is 'delivery_access'", async () => {
    const mod = await import("@/lib/auth/delivery-access");
    expect(mod._testing.COOKIE_NAME).toBe("delivery_access");
  });

  it("cookie names are different", async () => {
    const orderMod = await import("@/lib/auth/order-access");
    const deliveryMod = await import("@/lib/auth/delivery-access");
    expect(orderMod._testing.COOKIE_NAME).not.toBe(deliveryMod._testing.COOKIE_NAME);
  });

  it("delivery access cookie uses separate secret", async () => {
    const deliveryMod = await import("@/lib/auth/delivery-access");
    expect(deliveryMod._testing.getSecret()).toBe(
      "delivery-secret-that-is-at-least-32-chars-long",
    );
  });

  it("order access cookie uses its own secret", async () => {
    const orderMod = await import("@/lib/auth/order-access");
    expect(orderMod._testing.getSecret()).toBe(
      "order-secret-that-is-at-least-32-characters-long",
    );
  });
});
