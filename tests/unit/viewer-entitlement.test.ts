import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyProductEntitlement } from "@/features/account/library-queries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

describe("Viewer Entitlement Verification (verifyProductEntitlement)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  interface MockClientParams {
    user?: { id: string; email: string } | null;
    customer?: { id: string; auth_user_id: string; email: string; name: string } | null;
    product?: { id: string; name: string; slug: string; is_active: boolean } | null;
    orders?: Array<{ id: string; order_code: string; paid_at: string | null; created_at: string; status: string }>;
    orderItems?: Array<{ id: string; order_id: string; product_id: string; created_at: string }>;
    orderBonusItems?: Array<{ id: string; order_id: string; bonus_product_id: string; created_at: string }>;
  }

  function createMockClient(params: MockClientParams): SupabaseClient<Database> {
    const user = params.user === undefined ? { id: "user-1", email: "user1@example.com" } : params.user;
    const customer = params.customer === undefined ? { id: "cust-1", auth_user_id: "user-1", email: "user1@example.com", name: "User 1" } : params.customer;
    const product = params.product === undefined ? { id: "11111111-1111-1111-1111-111111111111", name: "Ngữ Văn 7", slug: "ngu-van-7", is_active: true } : params.product;
    const orders = params.orders ?? [];
    const orderItems = params.orderItems ?? [];
    const orderBonusItems = params.orderBonusItems ?? [];

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : new Error("Not authenticated"),
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: customer, error: null }),
          };
        }

        if (table === "products") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: product, error: null }),
          };
        }

        if (table === "orders") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((col: string, val: string) => {
              if (col === "status") {
                const filtered = orders.filter((o) => o.status === val);
                return Promise.resolve({ data: filtered, error: null });
              }
              return Promise.resolve({ data: orders, error: null });
            }),
          };
        }

        if (table === "order_items") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((_col: string, prodId: string) => ({
              in: vi.fn((_inCol: string, orderIds: string[]) => {
                const filtered = orderItems.filter(
                  (item) => item.product_id === prodId && orderIds.includes(item.order_id),
                );
                return Promise.resolve({ data: filtered, error: null });
              }),
            })),
          };
        }

        if (table === "order_bonus_items") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((_col: string, prodId: string) => ({
              in: vi.fn((_inCol: string, orderIds: string[]) => {
                const filtered = orderBonusItems.filter(
                  (bonus) => bonus.bonus_product_id === prodId && orderIds.includes(bonus.order_id),
                );
                return Promise.resolve({ data: filtered, error: null });
              }),
            })),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
        };
      }),
    } as unknown as SupabaseClient<Database>;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Anonymous visitor denied
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 1: anonymous visitor is denied entitlement with UNAUTHENTICATED reason", async () => {
    const client = createMockClient({ user: null });
    const result = await verifyProductEntitlement("11111111-1111-1111-1111-111111111111", client);

    expect(result.entitled).toBe(false);
    if (!result.entitled) {
      expect(result.reason).toBe("UNAUTHENTICATED");
      expect(result.message).toContain("Vui lòng đăng nhập");
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Non-owner authenticated user denied
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 2: authenticated user who has not purchased the product is denied entitlement", async () => {
    const client = createMockClient({
      orders: [
        { id: "order-1", order_code: "VTS-001", paid_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z", status: "PAID" },
      ],
      orderItems: [
        // Purchased a different product (prod-2)
        { id: "item-1", order_id: "order-1", product_id: "22222222-2222-2222-2222-222222222222", created_at: "2026-10-01T00:00:00Z" },
      ],
      orderBonusItems: [],
    });

    const result = await verifyProductEntitlement("11111111-1111-1111-1111-111111111111", client);
    expect(result.entitled).toBe(false);
    if (!result.entitled) {
      expect(result.reason).toBe("NOT_ENTITLED");
      expect(result.message).toContain("chưa có quyền");
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: PAID owner allowed
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 3: customer with a valid PAID order item is granted entitlement", async () => {
    const client = createMockClient({
      orders: [
        { id: "order-paid", order_code: "VTS-PAID-01", paid_at: "2026-10-02T10:00:00Z", created_at: "2026-10-02T09:00:00Z", status: "PAID" },
      ],
      orderItems: [
        { id: "item-1", order_id: "order-paid", product_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-10-02T09:00:00Z" },
      ],
      orderBonusItems: [],
    });

    const result = await verifyProductEntitlement("11111111-1111-1111-1111-111111111111", client);
    expect(result.entitled).toBe(true);
    if (result.entitled) {
      expect(result.acquisitionType).toBe("PAID");
      expect(result.orderCode).toBe("VTS-PAID-01");
      expect(result.product.id).toBe("11111111-1111-1111-1111-111111111111");
      expect(result.customer.id).toBe("cust-1");
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: BONUS owner allowed
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 4: customer with a valid BONUS item attached to a PAID order is granted entitlement", async () => {
    const client = createMockClient({
      orders: [
        { id: "order-bundle", order_code: "VTS-BUNDLE-01", paid_at: "2026-10-05T08:00:00Z", created_at: "2026-10-05T08:00:00Z", status: "PAID" },
      ],
      orderItems: [
        { id: "item-parent", order_id: "order-bundle", product_id: "99999999-9999-9999-9999-999999999999", created_at: "2026-10-05T08:00:00Z" },
      ],
      orderBonusItems: [
        { id: "bonus-1", order_id: "order-bundle", bonus_product_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-10-05T08:00:00Z" },
      ],
    });

    const result = await verifyProductEntitlement("11111111-1111-1111-1111-111111111111", client);
    expect(result.entitled).toBe(true);
    if (result.entitled) {
      expect(result.acquisitionType).toBe("BONUS");
      expect(result.orderCode).toBe("VTS-BUNDLE-01");
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: REFUNDED-only denied
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 5: customer with ONLY a REFUNDED order for the product is denied entitlement", async () => {
    const client = createMockClient({
      orders: [
        { id: "order-refunded", order_code: "VTS-REF-01", paid_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z", status: "REFUNDED" },
      ],
      orderItems: [
        { id: "item-ref", order_id: "order-refunded", product_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-10-01T00:00:00Z" },
      ],
      orderBonusItems: [],
    });

    const result = await verifyProductEntitlement("11111111-1111-1111-1111-111111111111", client);
    expect(result.entitled).toBe(false);
    if (!result.entitled) {
      expect(result.reason).toBe("NOT_ENTITLED");
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Multiple acquisitions with one valid PAID remains allowed
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 6: customer with both a REFUNDED order and a distinct valid PAID order remains entitled", async () => {
    const client = createMockClient({
      orders: [
        { id: "order-ref", order_code: "VTS-REF-01", paid_at: "2026-09-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z", status: "REFUNDED" },
        { id: "order-paid-valid", order_code: "VTS-PAID-02", paid_at: "2026-10-10T00:00:00Z", created_at: "2026-10-10T00:00:00Z", status: "PAID" },
      ],
      orderItems: [
        { id: "item-old", order_id: "order-ref", product_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-09-01T00:00:00Z" },
        { id: "item-new", order_id: "order-paid-valid", product_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-10-10T00:00:00Z" },
      ],
      orderBonusItems: [],
    });

    const result = await verifyProductEntitlement("11111111-1111-1111-1111-111111111111", client);
    expect(result.entitled).toBe(true);
    if (result.entitled) {
      expect(result.acquisitionType).toBe("PAID");
      expect(result.orderCode).toBe("VTS-PAID-02");
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Customer isolation: Customer A cannot access Customer B product
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 7: Customer Isolation — Customer A cannot access product purchased exclusively by Customer B", async () => {
    // Under Supabase RLS, Customer A querying orders only sees Customer A's rows.
    // Customer B's orders are invisible in Customer A's session.
    const customerAClient = createMockClient({
      user: { id: "user-A", email: "custA@example.com" },
      customer: { id: "cust-A", auth_user_id: "user-A", email: "custA@example.com", name: "Customer A" },
      // Customer A has no orders for product-1
      orders: [],
      orderItems: [],
    });

    const resultA = await verifyProductEntitlement("11111111-1111-1111-1111-111111111111", customerAClient);
    expect(resultA.entitled).toBe(false);
    if (!resultA.entitled) {
      expect(resultA.reason).toBe("NOT_ENTITLED");
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: URL productId / fileId tampering denied (non-existent or invalid product)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 8: URL tampering with invalid or non-existent product ID/slug returns PRODUCT_NOT_FOUND", async () => {
    const client = createMockClient({
      product: null, // Product does not exist
    });

    const result = await verifyProductEntitlement("99999999-9999-9999-9999-999999999999", client);
    expect(result.entitled).toBe(false);
    if (!result.entitled) {
      expect(result.reason).toBe("PRODUCT_NOT_FOUND");
    }
  });
});

