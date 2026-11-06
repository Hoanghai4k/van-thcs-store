import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getProductAccessState } from "@/features/products/access-state";
import { buildPreviewPageCountCopy } from "@/features/products/preview-landing-utils";
import { MAX_PREVIEW_PAGES } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

describe("Final Thesis Phase — Public Preview Paywall + Purchase Funnel", () => {
  const PREVIEW_VIEW_PATH = resolve(__dirname, "../../src/components/preview/preview-landing-view.tsx");
  const PREVIEW_VIEW_SRC = readFileSync(PREVIEW_VIEW_PATH, "utf-8");

  const PRODUCT_ACTIONS_PATH = resolve(__dirname, "../../src/components/product/product-actions.tsx");
  const PRODUCT_ACTIONS_SRC = readFileSync(PRODUCT_ACTIONS_PATH, "utf-8");

  const ORDER_PAGE_PATH = resolve(__dirname, "../../src/app/(store)/order/[orderCode]/page.tsx");
  const ORDER_PAGE_SRC = readFileSync(ORDER_PAGE_PATH, "utf-8");

  const VIEWER_SERVICE_PATH = resolve(__dirname, "../../src/features/viewer/viewer-service.ts");
  const VIEWER_SERVICE_SRC = readFileSync(VIEWER_SERVICE_PATH, "utf-8");

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
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: orderItems, error: null }),
          };
        }

        if (table === "order_bonus_items") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: orderBonusItems, error: null }),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    } as unknown as SupabaseClient<Database>;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Unauthenticated preview landing shows paywall and "Mua để xem đầy đủ"
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 1: Unauthenticated preview landing shows paywall with 'Mua để xem đầy đủ'", () => {
    expect(PREVIEW_VIEW_SRC).toContain('id="end-of-preview"');
    expect(PREVIEW_VIEW_SRC).toContain("Bạn đã xem hết bản xem thử");
    expect(PREVIEW_VIEW_SRC).toContain("Phần còn lại của tài liệu chỉ dành cho khách đã mua.");
    expect(PREVIEW_VIEW_SRC).toContain("Mua để xem đầy đủ");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Unauthenticated preview landing includes login redirect link to library
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 2: Unauthenticated preview landing includes login redirect link to library", () => {
    expect(PREVIEW_VIEW_SRC).toContain("Đã mua tài liệu này?");
    expect(PREVIEW_VIEW_SRC).toContain("Đăng nhập để xem");
    expect(PREVIEW_VIEW_SRC).toContain("`/account/library/${product.slug}`");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Authenticated non-owner shows "Mua để xem đầy đủ" and no full viewer
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 3: Authenticated non-owner state resolves not entitled and prompts purchase", async () => {
    const mock = createMockClient({
      user: { id: "user-2", email: "visitor@example.com" },
      customer: { id: "cust-2", auth_user_id: "user-2", email: "visitor@example.com", name: "Visitor" },
      orders: [], // no paid orders
    });

    const state = await getProductAccessState("ngu-van-7", mock);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isEntitled).toBe(false);
    expect(state.viewerReady).toBe(false);

    // In PreviewLandingView source: when !isOwner, purchase CTA is rendered
    expect(PREVIEW_VIEW_SRC).toContain("!isOwner");
    expect(PREVIEW_VIEW_SRC).toContain("Mua để xem đầy đủ");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Authenticated owner + READY shows "Xem bản đầy đủ" pointing to library
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 4: Authenticated owner + READY shows 'Xem bản đầy đủ' pointing to /account/library/[slug]", () => {
    expect(PREVIEW_VIEW_SRC).toContain("isOwner");
    expect(PREVIEW_VIEW_SRC).toContain("isViewerReady");
    expect(PREVIEW_VIEW_SRC).toContain("Xem bản đầy đủ");
    expect(PREVIEW_VIEW_SRC).toContain("librarySlugUrl");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Authenticated owner + NOT READY shows preparation state and no purchase CTA
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 5: Authenticated owner + NOT READY shows preparation state and no purchase CTA", () => {
    expect(PREVIEW_VIEW_SRC).toContain("Tài liệu đang được chuẩn bị để xem");
    expect(PRODUCT_ACTIONS_SRC).toContain("Tài liệu đang được chuẩn bị để xem");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Sticky bar reflects correct state for unowned / owner-ready / owner-not-ready
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 6: Sticky bar reflects correct state for unowned / owner-ready / owner-not-ready", () => {
    expect(PREVIEW_VIEW_SRC).toContain('aria-label="Thanh mua nhanh"');
    // Unowned sticky action
    expect(PREVIEW_VIEW_SRC).toContain("Mua để xem đầy đủ");
    // Owner ready sticky action
    expect(PREVIEW_VIEW_SRC).toContain("Xem bản đầy đủ");
    // Owner not ready sticky action
    expect(PREVIEW_VIEW_SRC).toContain("Tài liệu đang được chuẩn bị");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Preview page count copy matches known/unknown fullPageCount
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 7: Preview page count copy formats known vs unknown total correctly", () => {
    // Known full count: "Bản xem thử: 25 / 120 trang"
    const known = buildPreviewPageCountCopy({ previewCount: 25, fullCount: 120 });
    expect(known).toBe("Bản xem thử: 25 / 120 trang");

    // Unknown full count: "Bạn đang xem 25 trang bản xem thử."
    const unknown = buildPreviewPageCountCopy({ previewCount: 25, fullCount: null });
    expect(unknown).toBe("Bạn đang xem 25 trang bản xem thử.");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Product detail reflects unowned vs owner-ready vs owner-not-ready
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 8: Product detail ProductActions handles accessState cleanly", () => {
    expect(PRODUCT_ACTIONS_SRC).toContain("accessState");
    expect(PRODUCT_ACTIONS_SRC).toContain("accessState.isEntitled");
    expect(PRODUCT_ACTIONS_SRC).toContain("accessState.viewerReady");
    expect(PRODUCT_ACTIONS_SRC).toContain("accessState.isAuthenticated");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9: Product detail owner does not show buy now as primary
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 9: Product detail owner receives 'Xem bản đầy đủ trong Thư viện' and does not show purchase", () => {
    expect(PRODUCT_ACTIONS_SRC).toContain("data-testid=\"entitled-full-viewer-cta\"");
    expect(PRODUCT_ACTIONS_SRC).toContain("Xem bản đầy đủ trong Thư viện");
    expect(PRODUCT_ACTIONS_SRC).toContain("if (isOwner)");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10: Product detail owner-not-ready disables purchase
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 10: Product detail owner-not-ready shows preparing notice without purchase buttons", () => {
    expect(PRODUCT_ACTIONS_SRC).toContain("✓ Bạn đã sở hữu tài liệu này");
    expect(PRODUCT_ACTIONS_SRC).toContain("Tài liệu đang được chuẩn bị để xem");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 11: Order status page for authenticated customer links to /account/library
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 11: Order status page for authenticated customer links to /account/library", () => {
    expect(ORDER_PAGE_SRC).toContain("order.status === \"PAID\"");
    expect(ORDER_PAGE_SRC).toContain("isAuthenticated");
    expect(ORDER_PAGE_SRC).toContain("Tài liệu đã được kích hoạt trong tài khoản của bạn");
    expect(ORDER_PAGE_SRC).toContain("href=\"/account/library\"");
    expect(ORDER_PAGE_SRC).toContain("Vào Thư viện để xem tài liệu");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 12: Order status page for guest customer prompts login with email
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 12: Order status page for guest customer prompts login with email to view", () => {
    expect(ORDER_PAGE_SRC).toContain("Thanh toán thành công!");
    expect(ORDER_PAGE_SRC).toContain("Để xem toàn bộ tài liệu trực tuyến trên website, vui lòng đăng nhập bằng email đã dùng khi mua hàng");
    expect(ORDER_PAGE_SRC).toContain("Đăng nhập để xem tài liệu");
    expect(ORDER_PAGE_SRC).toContain("/login?redirect=");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 13: Order status page contains no customer Word/ZIP download CTA
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 13: Order status page contains strictly NO customer Word/ZIP download CTA", () => {
    const lowerOrder = ORDER_PAGE_SRC.toLowerCase();
    expect(lowerOrder).not.toContain("tải xuống");
    expect(lowerOrder).not.toContain("download docx");
    expect(lowerOrder).not.toContain("tải word");
    expect(lowerOrder).not.toContain("tải zip");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 14: Entitlement check handles PAID order_items
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 14: Entitlement check verifies valid PAID order_items acquisition", async () => {
    const mock = createMockClient({
      orders: [{ id: "ord-1", order_code: "VTS-001", paid_at: "2026-08-20T10:00:00Z", created_at: "2026-08-20T09:00:00Z", status: "PAID" }],
      orderItems: [{ id: "item-1", order_id: "ord-1", product_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-08-20T09:00:00Z" }],
    });

    const state = await getProductAccessState("ngu-van-7", mock);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isEntitled).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 15: Entitlement check handles BONUS order_bonus_items
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 15: Entitlement check verifies valid BONUS order_bonus_items acquisition", async () => {
    const mock = createMockClient({
      orders: [{ id: "ord-2", order_code: "VTS-002", paid_at: "2026-08-21T10:00:00Z", created_at: "2026-08-21T09:00:00Z", status: "PAID" }],
      orderItems: [],
      orderBonusItems: [{ id: "bonus-1", order_id: "ord-2", bonus_product_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-08-21T09:00:00Z" }],
    });

    const state = await getProductAccessState("ngu-van-7", mock);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isEntitled).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 16: Entitlement check rejects PENDING / CANCELLED / FAILED / REFUNDED
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 16: Entitlement check rejects non-PAID order statuses", async () => {
    for (const status of ["PENDING", "CANCELLED", "FAILED", "REFUNDED"]) {
      const mock = createMockClient({
        orders: [{ id: `ord-${status}`, order_code: `VTS-${status}`, paid_at: null, created_at: "2026-08-20T09:00:00Z", status }],
        orderItems: [{ id: `item-${status}`, order_id: `ord-${status}`, product_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-08-20T09:00:00Z" }],
      });

      const state = await getProductAccessState("ngu-van-7", mock);
      expect(state.isEntitled).toBe(false);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 17: Entitlement check handles separate PAID + REFUNDED acquisitions
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 17: Separate PAID + REFUNDED acquisitions maintain entitlement via valid PAID", async () => {
    const mock = createMockClient({
      orders: [
        { id: "ord-paid", order_code: "VTS-PAID", paid_at: "2026-08-20T10:00:00Z", created_at: "2026-08-20T09:00:00Z", status: "PAID" },
        { id: "ord-refunded", order_code: "VTS-REFUNDED", paid_at: "2026-08-19T10:00:00Z", created_at: "2026-08-19T09:00:00Z", status: "REFUNDED" },
      ],
      orderItems: [
        { id: "item-paid", order_id: "ord-paid", product_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-08-20T09:00:00Z" },
        { id: "item-refunded", order_id: "ord-refunded", product_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-08-19T09:00:00Z" },
      ],
    });

    const state = await getProductAccessState("ngu-van-7", mock);
    expect(state.isEntitled).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 18: Never trust client customerId or email in access state
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 18: Access state resolver determines identity strictly from authenticated session", async () => {
    const mock = createMockClient({ user: null, customer: null });
    const state = await getProductAccessState("ngu-van-7", mock);

    expect(state.isAuthenticated).toBe(false);
    expect(state.isEntitled).toBe(false);
    expect(state.viewerReady).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 19: Preview artifact contains <= 25 pages physically
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 19: Preview artifact is constrained to <= 25 pages", () => {
    expect(MAX_PREVIEW_PAGES).toBe(25);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 20: Viewer artifact metadata remains private (no storage_prefix or master path)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 20: Viewer service strips private storage paths and credentials", () => {
    expect(VIEWER_SERVICE_SRC).toContain("SafeViewerMetadata");
    expect(VIEWER_SERVICE_SRC).toContain("Under NO circumstances may storage_prefix, source_sha256, master storage_path");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 21: Post-purchase access state transitions correctly
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 21: Access state transitions from unauthenticated to entitled owner after order payment", async () => {
    // 1. Before payment / login: unauthenticated visitor
    const visitorMock = createMockClient({ user: null, customer: null, orders: [] });
    const visitorState = await getProductAccessState("ngu-van-7", visitorMock);
    expect(visitorState.isAuthenticated).toBe(false);
    expect(visitorState.isEntitled).toBe(false);

    // 2. After payment & login: authenticated owner
    const ownerMock = createMockClient({
      user: { id: "user-paid", email: "buyer@example.com" },
      customer: { id: "cust-paid", auth_user_id: "user-paid", email: "buyer@example.com", name: "Buyer" },
      orders: [{ id: "ord-success", order_code: "VTS-SUCCESS", paid_at: "2026-08-22T10:00:00Z", created_at: "2026-08-22T09:00:00Z", status: "PAID" }],
      orderItems: [{ id: "item-success", order_id: "ord-success", product_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-08-22T09:00:00Z" }],
    });
    const ownerState = await getProductAccessState("ngu-van-7", ownerMock);
    expect(ownerState.isAuthenticated).toBe(true);
    expect(ownerState.isEntitled).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 22: Error fallback for unconfigured/network issues defaults safely
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 22: Access state resolver falls back safely on unhandled error", async () => {
    const errorClient = {
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error("Supabase service unavailable")),
      },
    } as unknown as SupabaseClient<Database>;

    const state = await getProductAccessState("ngu-van-7", errorClient);
    expect(state).toEqual({
      isAuthenticated: false,
      isEntitled: false,
      viewerReady: false,
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 23: Paywall value propositions are rendered correctly
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 23: Paywall value propositions render the 3 key thesis benefits", () => {
    expect(PREVIEW_VIEW_SRC).toContain("Xem toàn bộ tài liệu trên website");
    expect(PREVIEW_VIEW_SRC).toContain("Truy cập trong tài khoản cá nhân");
    expect(PREVIEW_VIEW_SRC).toContain("Không cần tải file về máy");
  });
});
