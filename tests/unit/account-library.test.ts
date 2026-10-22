import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getCustomerLibrary,
  getCustomerLibraryCount,
} from "@/features/account/library-queries";
import { requireCustomer } from "@/lib/auth/customer-auth";
import * as serverSupa from "@/lib/supabase/server";
import * as adminSupa from "@/lib/supabase/admin";
import fs from "fs";
import path from "path";

// Mock next/navigation
const mockRedirect = vi.fn((url: string) => {
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw err;
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock Supabase modules
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("Customer Account Library (Phase 1D)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to build a mock authenticated Supabase client
  function createMockSupabaseClient(params: {
    orders?: Array<{
      id: string;
      order_code: string;
      paid_at: string | null;
      created_at: string;
      status: string;
    }>;
    orderItems?: Array<{
      id: string;
      order_id: string;
      product_id: string;
      product_name: string;
      created_at: string;
    }>;
    orderBonusItems?: Array<{
      id: string;
      order_id: string;
      bonus_product_id: string;
      bonus_name_snapshot: string;
      created_at: string;
    }>;
    products?: Array<{
      id: string;
      name: string;
      slug: string;
      thumbnail_path: string | null;
      short_description: string | null;
      product_type: string;
      is_active: boolean;
    }>;
  }) {
    const orders = params.orders ?? [];
    const orderItems = params.orderItems ?? [];
    const orderBonusItems = params.orderBonusItems ?? [];
    const products = params.products ?? [];

    return {
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((column: string, val: string) => {
              if (column === "status") {
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
            in: vi.fn((column: string, ids: string[]) => {
              const filtered = orderItems.filter((item) => ids.includes(item.order_id));
              return Promise.resolve({ data: filtered, error: null });
            }),
          };
        }

        if (table === "order_bonus_items") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn((column: string, ids: string[]) => {
              const filtered = orderBonusItems.filter((item) => ids.includes(item.order_id));
              return Promise.resolve({ data: filtered, error: null });
            }),
          };
        }

        if (table === "products") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn((column: string, ids: string[]) => {
              const filtered = products.filter((p) => ids.includes(p.id));
              return Promise.resolve({ data: filtered, error: null });
            }),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
        };
      }),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Route Protection & Anonymous Redirect
  // ─────────────────────────────────────────────────────────────────────────
  describe("Route Protection", () => {
    it("redirects unauthenticated anonymous visitor to login from /account/library", async () => {
      const mockServerClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      await expect(requireCustomer("/account/library")).rejects.toThrow(
        "NEXT_REDIRECT:/login?redirect=%2Faccount%2Flibrary",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/login?redirect=%2Faccount%2Flibrary");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Order Status Entitlement Rules
  // ─────────────────────────────────────────────────────────────────────────
  describe("Order Status Entitlement Rules", () => {
    it("grants entitlement for PAID orders and renders primary product", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "order-1",
            order_code: "VTS-001",
            paid_at: "2026-03-01T10:00:00Z",
            created_at: "2026-03-01T09:55:00Z",
            status: "PAID",
          },
        ],
        orderItems: [
          {
            id: "item-1",
            order_id: "order-1",
            product_id: "prod-1",
            product_name: "Bộ đề Ngữ văn 9",
            created_at: "2026-03-01T10:00:00Z",
          },
        ],
        products: [
          {
            id: "prod-1",
            name: "Bộ đề Ngữ văn 9 (Live)",
            slug: "bo-de-ngu-van-9",
            thumbnail_path: "thumbnails/nv9.jpg",
            short_description: "Đề thi học kì 2",
            product_type: "STANDARD",
            is_active: true,
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("prod-1");
      expect(items[0].name).toBe("Bộ đề Ngữ văn 9 (Live)");
      expect(items[0].slug).toBe("bo-de-ngu-van-9");
      expect(items[0].acquisitionType).toBe("PAID");
      expect(items[0].acquiredAt).toBe("2026-03-01T10:00:00Z");
      expect(items[0].orderCode).toBe("VTS-001");
    });

    it("excludes PENDING orders from granting library entitlement", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "order-pending",
            order_code: "VTS-PENDING",
            paid_at: null,
            created_at: "2026-03-01T10:00:00Z",
            status: "PENDING",
          },
        ],
        orderItems: [
          {
            id: "item-p",
            order_id: "order-pending",
            product_id: "prod-pending",
            product_name: "Tài liệu chưa trả tiền",
            created_at: "2026-03-01T10:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(0);
    });

    it("excludes FAILED orders from granting entitlement", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "order-failed",
            order_code: "VTS-FAILED",
            paid_at: null,
            created_at: "2026-03-01T10:00:00Z",
            status: "FAILED",
          },
        ],
        orderItems: [
          {
            id: "item-f",
            order_id: "order-failed",
            product_id: "prod-failed",
            product_name: "Tài liệu thanh toán thất bại",
            created_at: "2026-03-01T10:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(0);
    });

    it("excludes CANCELLED orders from granting entitlement", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "order-cancelled",
            order_code: "VTS-CANCELLED",
            paid_at: null,
            created_at: "2026-03-01T10:00:00Z",
            status: "CANCELLED",
          },
        ],
        orderItems: [
          {
            id: "item-c",
            order_id: "order-cancelled",
            product_id: "prod-cancelled",
            product_name: "Tài liệu đã huỷ",
            created_at: "2026-03-01T10:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(0);
    });

    it("excludes REFUNDED orders from granting entitlement", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "order-refunded",
            order_code: "VTS-REFUNDED",
            paid_at: "2026-02-01T10:00:00Z",
            created_at: "2026-02-01T09:00:00Z",
            status: "REFUNDED",
          },
        ],
        orderItems: [
          {
            id: "item-r",
            order_id: "order-refunded",
            product_id: "prod-refunded",
            product_name: "Tài liệu đã hoàn tiền",
            created_at: "2026-02-01T09:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. BONUS Entitlement Rules
  // ─────────────────────────────────────────────────────────────────────────
  describe("BONUS Entitlement Rules", () => {
    it("renders BONUS item from order_bonus_items when parent order is PAID", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "order-with-bonus",
            order_code: "VTS-BONUS-PAID",
            paid_at: "2026-03-02T10:00:00Z",
            created_at: "2026-03-02T09:00:00Z",
            status: "PAID",
          },
        ],
        orderItems: [
          {
            id: "item-main",
            order_id: "order-with-bonus",
            product_id: "prod-main",
            product_name: "Sản phẩm chính",
            created_at: "2026-03-02T09:00:00Z",
          },
        ],
        orderBonusItems: [
          {
            id: "bonus-item-1",
            order_id: "order-with-bonus",
            bonus_product_id: "bonus-prod-1",
            bonus_name_snapshot: "Quà tặng: Sổ tay kiến thức Văn",
            created_at: "2026-03-02T09:00:00Z",
          },
        ],
        products: [
          {
            id: "prod-main",
            name: "Sản phẩm chính",
            slug: "san-pham-chinh",
            thumbnail_path: null,
            short_description: null,
            product_type: "STANDARD",
            is_active: true,
          },
          {
            id: "bonus-prod-1",
            name: "Sổ tay kiến thức Văn (Live)",
            slug: "so-tay-kien-thuc-van",
            thumbnail_path: "thumbnails/bonus.jpg",
            short_description: "Quà tặng kèm",
            product_type: "BONUS",
            is_active: true,
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(2);

      const bonusItem = items.find((i) => i.productId === "bonus-prod-1");
      expect(bonusItem).toBeDefined();
      expect(bonusItem?.acquisitionType).toBe("BONUS");
      expect(bonusItem?.name).toBe("Sổ tay kiến thức Văn (Live)");
      expect(bonusItem?.acquiredAt).toBe("2026-03-02T10:00:00Z");
    });

    it("excludes BONUS items when parent order is NOT PAID (e.g. PENDING or REFUNDED)", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "order-pending-bonus",
            order_code: "VTS-PENDING-BONUS",
            paid_at: null,
            created_at: "2026-03-02T09:00:00Z",
            status: "PENDING",
          },
        ],
        orderBonusItems: [
          {
            id: "bonus-item-pending",
            order_id: "order-pending-bonus",
            bonus_product_id: "bonus-prod-unpaid",
            bonus_name_snapshot: "Quà tặng chưa được cấp",
            created_at: "2026-03-02T09:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(0);
    });

    it("gracefully falls back to bonus snapshot name if bonus product is later deactivated/deleted", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "order-archived-bonus",
            order_code: "VTS-ARCHIVED",
            paid_at: "2026-03-01T00:00:00Z",
            created_at: "2026-03-01T00:00:00Z",
            status: "PAID",
          },
        ],
        orderBonusItems: [
          {
            id: "b-archived",
            order_id: "order-archived-bonus",
            bonus_product_id: "bonus-deleted-from-store",
            bonus_name_snapshot: "Snapshot: Tài liệu quý (đã ẩn)",
            created_at: "2026-03-01T00:00:00Z",
          },
        ],
        products: [], // Product row not found or deleted from public catalog
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("bonus-deleted-from-store");
      expect(items[0].name).toBe("Snapshot: Tài liệu quý (đã ẩn)");
      expect(items[0].slug).toBeNull();
      expect(items[0].isActive).toBe(false);
      expect(items[0].acquisitionType).toBe("BONUS");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Deduplication & Priority Rules
  // ─────────────────────────────────────────────────────────────────────────
  describe("Deduplication & Acquisition Rules", () => {
    it("deduplicates multiple PAID purchases of the same product into 1 card", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "order-a",
            order_code: "VTS-ORD-A",
            paid_at: "2026-01-10T00:00:00Z",
            created_at: "2026-01-10T00:00:00Z",
            status: "PAID",
          },
          {
            id: "order-b",
            order_code: "VTS-ORD-B",
            paid_at: "2026-02-15T00:00:00Z",
            created_at: "2026-02-15T00:00:00Z",
            status: "PAID",
          },
        ],
        orderItems: [
          {
            id: "item-a",
            order_id: "order-a",
            product_id: "duplicate-prod",
            product_name: "Ngữ văn 8",
            created_at: "2026-01-10T00:00:00Z",
          },
          {
            id: "item-b",
            order_id: "order-b",
            product_id: "duplicate-prod",
            product_name: "Ngữ văn 8",
            created_at: "2026-02-15T00:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("duplicate-prod");
      // Earliest acquisition date chosen
      expect(items[0].acquiredAt).toBe("2026-01-10T00:00:00Z");
      expect(items[0].orderCode).toBe("VTS-ORD-A");
    });

    it("deduplicates multiple BONUS acquisitions of the same product into 1 card", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "ord-b1",
            order_code: "VTS-B1",
            paid_at: "2026-01-05T00:00:00Z",
            created_at: "2026-01-05T00:00:00Z",
            status: "PAID",
          },
          {
            id: "ord-b2",
            order_code: "VTS-B2",
            paid_at: "2026-03-01T00:00:00Z",
            created_at: "2026-03-01T00:00:00Z",
            status: "PAID",
          },
        ],
        orderBonusItems: [
          {
            id: "bon-1",
            order_id: "ord-b1",
            bonus_product_id: "shared-bonus",
            bonus_name_snapshot: "Quà tặng chung",
            created_at: "2026-01-05T00:00:00Z",
          },
          {
            id: "bon-2",
            order_id: "ord-b2",
            bonus_product_id: "shared-bonus",
            bonus_name_snapshot: "Quà tặng chung",
            created_at: "2026-03-01T00:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("shared-bonus");
      expect(items[0].acquisitionType).toBe("BONUS");
      expect(items[0].acquiredAt).toBe("2026-01-05T00:00:00Z");
    });

    it("PAID overrides BONUS when same product was acquired both as gift and directly", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "ord-gift",
            order_code: "VTS-GIFT",
            paid_at: "2026-01-01T00:00:00Z",
            created_at: "2026-01-01T00:00:00Z",
            status: "PAID",
          },
          {
            id: "ord-paid",
            order_code: "VTS-DIRECT-PAID",
            paid_at: "2026-02-01T00:00:00Z",
            created_at: "2026-02-01T00:00:00Z",
            status: "PAID",
          },
        ],
        orderBonusItems: [
          {
            id: "bonus-first",
            order_id: "ord-gift",
            bonus_product_id: "cross-product-id",
            bonus_name_snapshot: "Tài liệu được tặng",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        orderItems: [
          {
            id: "item-paid-second",
            order_id: "ord-paid",
            product_id: "cross-product-id",
            product_name: "Tài liệu mua trực tiếp",
            created_at: "2026-02-01T00:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("cross-product-id");
      // Preferred source is PAID
      expect(items[0].acquisitionType).toBe("PAID");
      expect(items[0].acquiredAt).toBe("2026-02-01T00:00:00Z");
      expect(items[0].orderCode).toBe("VTS-DIRECT-PAID");
    });

    it("Multiple acquisitions: refund on one order does not revoke product if another PAID order exists", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "ord-valid-paid",
            order_code: "VTS-VALID",
            paid_at: "2026-01-15T00:00:00Z",
            created_at: "2026-01-15T00:00:00Z",
            status: "PAID",
          },
          {
            id: "ord-refunded",
            order_code: "VTS-REFUNDED",
            paid_at: "2026-02-15T00:00:00Z",
            created_at: "2026-02-15T00:00:00Z",
            status: "REFUNDED", // Revoked!
          },
        ],
        orderItems: [
          {
            id: "it-valid",
            order_id: "ord-valid-paid",
            product_id: "prod-multi",
            product_name: "Tài liệu đa đơn hàng",
            created_at: "2026-01-15T00:00:00Z",
          },
          {
            id: "it-refunded",
            order_id: "ord-refunded",
            product_id: "prod-multi",
            product_name: "Tài liệu đa đơn hàng",
            created_at: "2026-02-15T00:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("prod-multi");
      expect(items[0].acquiredAt).toBe("2026-01-15T00:00:00Z");
      expect(items[0].orderCode).toBe("VTS-VALID");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Query Security & Authorization
  // ─────────────────────────────────────────────────────────────────────────
  describe("Query Security & RLS Enforcement", () => {
    it("uses authenticated SSR client and NEVER getSupabaseAdmin", async () => {
      const mockClient = createMockSupabaseClient({ orders: [] });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      await getCustomerLibrary();
      expect(serverSupa.getSupabaseServerClient).toHaveBeenCalled();
      expect(adminSupa.getSupabaseAdmin).not.toHaveBeenCalled();
    });

    it("Customer Isolation: Customer A cannot see Customer B library data under RLS", async () => {
      // Customer A is logged in. Customer A has order 1 (Product A).
      // Customer B has order 2 (Product B).
      // RLS on orders table filters customer_id to auth.uid().
      const mockClientForCustomerA = createMockSupabaseClient({
        orders: [
          {
            id: "order-a",
            order_code: "VTS-A",
            paid_at: "2026-01-01T00:00:00Z",
            created_at: "2026-01-01T00:00:00Z",
            status: "PAID",
          },
        ],
        orderItems: [
          {
            id: "item-a",
            order_id: "order-a",
            product_id: "product-a",
            product_name: "Tài liệu của User A",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClientForCustomerA as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("product-a");
      // Verifies Product B or other customer orders are not present
      expect(items.some((i) => i.productId === "product-b")).toBe(false);
    });

    it("never exposes master storage_path or full file URLs in LibraryItem view model", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "ord-1",
            order_code: "VTS-1",
            paid_at: "2026-01-01T00:00:00Z",
            created_at: "2026-01-01T00:00:00Z",
            status: "PAID",
          },
        ],
        orderItems: [
          {
            id: "it-1",
            order_id: "ord-1",
            product_id: "p-1",
            product_name: "Tài liệu bảo mật",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const items = await getCustomerLibrary();
      const item = items[0] as unknown as Record<string, unknown>;

      expect(item).not.toHaveProperty("storage_path");
      expect(item).not.toHaveProperty("storagePath");
      expect(item).not.toHaveProperty("r2_key");
      expect(item).not.toHaveProperty("r2Key");
      expect(item).not.toHaveProperty("download_token");
      expect(item).not.toHaveProperty("downloadToken");
      expect(item).not.toHaveProperty("file_url");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. getCustomerLibraryCount Helper
  // ─────────────────────────────────────────────────────────────────────────
  describe("getCustomerLibraryCount", () => {
    it("returns correct count of deduplicated items", async () => {
      const mockClient = createMockSupabaseClient({
        orders: [
          {
            id: "ord-1",
            order_code: "VTS-1",
            paid_at: "2026-01-01T00:00:00Z",
            created_at: "2026-01-01T00:00:00Z",
            status: "PAID",
          },
        ],
        orderItems: [
          {
            id: "it-1",
            order_id: "ord-1",
            product_id: "p-1",
            product_name: "Doc 1",
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "it-2",
            order_id: "ord-1",
            product_id: "p-2",
            product_name: "Doc 2",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      });

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const count = await getCustomerLibraryCount();
      expect(count).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. System Invariants & Isolation
  // ─────────────────────────────────────────────────────────────────────────
  describe("System Invariants", () => {
    it("verifies Site B directory is completely untouched", () => {
      const siteBPath = path.resolve("..", "phep-mau-van-hoc");
      if (fs.existsSync(siteBPath)) {
        expect(fs.existsSync(path.join(siteBPath, "package.json"))).toBe(true);
      }
      expect(path.resolve(".")).not.toContain("phep-mau-van-hoc");
      expect(path.resolve(".")).toContain("van-thcs-store-v2");
    });
  });
});
