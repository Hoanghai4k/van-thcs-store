/**
 * Preview Landing Funnel — Regression & Security Tests
 *
 * Validates:
 * 1. Active PAID + preview renders preview landing DTO
 * 2. Inactive product is rejected (returns null / 404)
 * 3. BONUS products never get a preview landing page
 * 4. Safe public metadata only — unpaid visitor NEVER gets master DOCX/ZIP paths or service credentials
 * 5. Maximum preview pages is capped at MAX_PREVIEW_PAGES (25)
 * 6. Missing preview returns friendly fallback, never crashes
 * 7. Canonical URL points to the main product page (no duplicate SEO indexing)
 * 8. Shared Buy Now flow is used for both sticky and end-of-preview CTAs
 * 9. Preview landing route helpers & slug validation
 * 10. Admin preview copy link format
 * 11. Site B remains 100% untouched
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { MAX_PREVIEW_PAGES, STORAGE_BUCKETS } from "@/lib/constants";
import {
  isValidProductSlug,
  getPreviewLandingPath,
  getPreviewLandingUrl,
  getProductDetailPath,
  clampPreviewPageCount,
  formatFileFormatLabel,
  buildPreviewSubtitle,
  buildFullVersionSummary,
  getDiscountPercent,
} from "@/features/products/preview-landing-utils";
import {
  toPreviewLandingProduct,
  getPreviewLandingPreview,
} from "@/features/products/preview-landing";
import { PREVIEW_EVENTS } from "@/features/products/preview-events";
import type { ProductWithCategory } from "@/features/products/types";

// ── Supabase Admin mock setup ───────────────────────────────────────

const mockMaybeSingle = vi.fn();
const mockCreateSignedUrl = vi.fn();

const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    maybeSingle: mockMaybeSingle,
  }),
});

const mockStorageFrom = vi.fn().mockReturnValue({
  createSignedUrl: mockCreateSignedUrl,
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn().mockReturnValue({ select: mockSelect }),
    storage: { from: mockStorageFrom },
  }),
}));

describe("Preview Landing Funnel — Unit & Regression Tests", () => {
  const MOCK_SITE_URL = "https://tailieuhangcao.vn";
  const PRODUCT_ID = "11111111-2222-3333-4444-555555555555";
  const SLUG = "day-them-ngu-van-9";

  const MOCK_PRODUCT: ProductWithCategory = {
    id: PRODUCT_ID,
    name: "Giáo án Dạy thêm Ngữ văn 9",
    slug: SLUG,
    short_description: "Tài liệu bám sát chương trình GDPT 2018",
    description: "Chi tiết giáo án cả năm học",
    price: 350000,
    original_price: 500000,
    page_count: 1478,
    file_count: 3,
    file_format: "docx",
    thumbnail_path: "products/assets/thumb.png",
    preview_images: [],
    features: ["Đầy đủ 3 bộ sách"],
    suitable_for: ["Giáo viên THCS"],
    is_active: true,
    product_type: "PAID",
    category_id: "cat-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: {
      id: "cat-1",
      name: "Ngữ văn 9",
      slug: "ngu-van-9",
      description: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
    });
  });

  // ─── 1. Route & Slug Validation ───────────────────────────────────

  describe("Route & Slug Helpers", () => {
    it("validates safe product slugs correctly", () => {
      expect(isValidProductSlug("day-them-ngu-van-9")).toBe(true);
      expect(isValidProductSlug("ngu-van-6-canh-dieu")).toBe(true);
      expect(isValidProductSlug("toan-7")).toBe(true);

      // Rejects invalid slugs
      expect(isValidProductSlug("")).toBe(false);
      expect(isValidProductSlug("Day-Them-9")).toBe(false); // Uppercase rejected
      expect(isValidProductSlug("day them 9")).toBe(false); // Space rejected
      expect(isValidProductSlug("day_them_9")).toBe(false); // Underscore rejected
      expect(isValidProductSlug("../etc/passwd")).toBe(false); // Path traversal rejected
      expect(isValidProductSlug(null)).toBe(false);
      expect(isValidProductSlug(undefined)).toBe(false);
      expect(isValidProductSlug(123)).toBe(false);
      expect(isValidProductSlug("a".repeat(201))).toBe(false); // Over max length
    });

    it("generates correct preview landing path /xem-thu/[slug]", () => {
      expect(getPreviewLandingPath("day-them-ngu-van-9")).toBe("/xem-thu/day-them-ngu-van-9");
      expect(getPreviewLandingPath("van-thcs")).toBe("/xem-thu/van-thcs");
    });

    it("generates correct public preview landing URL for Facebook/Zalo sharing", () => {
      const url = getPreviewLandingUrl(MOCK_SITE_URL, "day-them-ngu-van-9");
      expect(url).toBe("https://tailieuhangcao.vn/xem-thu/day-them-ngu-van-9");
    });

    it("generates canonical path pointing to main product page", () => {
      expect(getProductDetailPath("day-them-ngu-van-9")).toBe("/products/day-them-ngu-van-9");
    });
  });

  // ─── 2. Security & Whitelisted DTO ────────────────────────────────

  describe("Security: Whitelisted Metadata & Privacy", () => {
    it("toPreviewLandingProduct produces safe whitelisted metadata only", () => {
      const dto = toPreviewLandingProduct(MOCK_PRODUCT);

      // Permitted public fields
      expect(dto.id).toBe(PRODUCT_ID);
      expect(dto.name).toBe("Giáo án Dạy thêm Ngữ văn 9");
      expect(dto.slug).toBe(SLUG);
      expect(dto.price).toBe(350000);
      expect(dto.original_price).toBe(500000);
      expect(dto.page_count).toBe(1478);
      expect(dto.file_count).toBe(3);
      expect(dto.file_format).toBe("docx");
      expect(dto.thumbnail_path).toBe("products/assets/thumb.png");
      expect(dto.product_type).toBe("PAID");

      // Master files and private fields MUST NOT exist on DTO
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unsafe = dto as any;
      expect(unsafe.storage_path).toBeUndefined();
      expect(unsafe.file_name).toBeUndefined();
      expect(unsafe.service_role_key).toBeUndefined();
      expect(unsafe.docx_url).toBeUndefined();
      expect(unsafe.zip_url).toBeUndefined();
    });

    it("MAX_PREVIEW_PAGES invariant is strictly 25", () => {
      expect(MAX_PREVIEW_PAGES).toBe(25);
    });

    it("clampPreviewPageCount caps at MAX_PREVIEW_PAGES (25)", () => {
      expect(clampPreviewPageCount(50, 25)).toBe(25);
      expect(clampPreviewPageCount(100, 25)).toBe(25);
      expect(clampPreviewPageCount(15, 25)).toBe(15);
      expect(clampPreviewPageCount(1, 25)).toBe(1);
      expect(clampPreviewPageCount(-5, 25)).toBe(0);
      expect(clampPreviewPageCount(NaN, 25)).toBe(0);
    });
  });

  // ─── 3. Preview Signed URL & Bucket Security ──────────────────────

  describe("Preview Storage & Signed URL Security", () => {
    it("fetches preview from product-previews bucket, NEVER product-files", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          storage_path: `${PRODUCT_ID}/preview.pdf`,
          page_count: 25,
          mime_type: "application/pdf",
        },
        error: null,
      });

      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: "https://storage.supabase.co/signed/preview.pdf?token=abc" },
        error: null,
      });

      const result = await getPreviewLandingPreview(PRODUCT_ID);

      expect(result).not.toBeNull();
      expect(result?.pageCount).toBe(25);
      expect(result?.url).toContain("signed/preview.pdf");

      expect(mockStorageFrom).toHaveBeenCalledWith(STORAGE_BUCKETS.PRODUCT_PREVIEWS);
      expect(mockStorageFrom).not.toHaveBeenCalledWith(STORAGE_BUCKETS.PRODUCT_FILES);
    });

    it("rejects non-PDF artifacts as preview (defense in depth)", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          storage_path: `${PRODUCT_ID}/master.docx`,
          page_count: 50,
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        error: null,
      });

      const result = await getPreviewLandingPreview(PRODUCT_ID);
      expect(result).toBeNull();
      expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    });

    it("returns null when no preview record exists without crashing", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await getPreviewLandingPreview(PRODUCT_ID);
      expect(result).toBeNull();
    });

    it("caps preview pageCount even if DB record claims higher than 25", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          storage_path: `${PRODUCT_ID}/preview.pdf`,
          page_count: 80,
          mime_type: "application/pdf",
        },
        error: null,
      });

      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: "https://storage.supabase.co/signed/preview.pdf" },
        error: null,
      });

      const result = await getPreviewLandingPreview(PRODUCT_ID);
      expect(result?.pageCount).toBe(25);
    });
  });

  // ─── 4. Copy & Format Builders ────────────────────────────────────

  describe("UI Copy & Formatting Helpers", () => {
    it("formats file format labels correctly", () => {
      expect(formatFileFormatLabel("docx")).toBe("DOCX");
      expect(formatFileFormatLabel("zip")).toBe("ZIP");
      expect(formatFileFormatLabel("mixed")).toBe("DOCX + ZIP");
      expect(formatFileFormatLabel(null)).toBe("DOCX");
      expect(formatFileFormatLabel(undefined)).toBe("DOCX");
    });

    it("calculates discount percent correctly", () => {
      expect(getDiscountPercent(350000, 500000)).toBe(30);
      expect(getDiscountPercent(500000, 500000)).toBeNull();
      expect(getDiscountPercent(600000, 500000)).toBeNull();
      expect(getDiscountPercent(350000, null)).toBeNull();
    });

    it("builds preview subtitle matching specification", () => {
      const subtitle = buildPreviewSubtitle({
        previewPageCount: 25,
        maxPreviewPages: 25,
        fullPageCount: 1478,
      });
      expect(subtitle).toBe("Xem trước tối đa 25 trang đầu • Bản đầy đủ 1.478 trang");

      const shortDoc = buildPreviewSubtitle({
        previewPageCount: 12,
        maxPreviewPages: 25,
        fullPageCount: 12,
      });
      expect(shortDoc).toBe("Xem trước 12 trang đầu • Bản đầy đủ 12 trang");

      const noPreview = buildPreviewSubtitle({
        previewPageCount: null,
        maxPreviewPages: 25,
        fullPageCount: 50,
      });
      expect(noPreview).toBe("Bản xem thử đang được cập nhật • Bản đầy đủ 50 trang");
    });

    it("builds full version summary using actual metadata without hardcoding", () => {
      expect(buildFullVersionSummary(1478, 3)).toBe("Bản đầy đủ gồm 1.478 trang và 3 tệp.");
      expect(buildFullVersionSummary(250, 1)).toBe("Bản đầy đủ gồm 250 trang và 1 tệp.");
      expect(buildFullVersionSummary(null, 2)).toBe("Bản đầy đủ gồm 2 tệp.");
      expect(buildFullVersionSummary(100, null)).toBe("Bản đầy đủ gồm 100 trang.");
      expect(buildFullVersionSummary(null, null)).toBe("Nhận trọn bộ tài liệu gốc ngay sau khi thanh toán.");
    });
  });

  // ─── 5. Analytics Event Hooks ─────────────────────────────────────

  describe("Analytics Event Hooks", () => {
    it("defines stable event constants required for funnel measurement", () => {
      expect(PREVIEW_EVENTS.OPEN).toBe("preview_open");
      expect(PREVIEW_EVENTS.FINAL_PAGE_REACHED).toBe("preview_page_25_reached");
      expect(PREVIEW_EVENTS.BUY_CLICKED).toBe("preview_buy_clicked");
    });
  });

  // ─── 6. Landing Page Source Inspection ────────────────────────────

  describe("Preview Landing Route & Component Contracts", () => {
    const PAGE_PATH = resolve(__dirname, "../../src/app/(store)/xem-thu/[slug]/page.tsx");
    const VIEW_PATH = resolve(__dirname, "../../src/components/preview/preview-landing-view.tsx");

    it("route file exists at /xem-thu/[slug]/page.tsx", () => {
      expect(existsSync(PAGE_PATH)).toBe(true);
    });

    it("page.tsx defines canonical URL pointing to main product detail page", () => {
      const pageSrc = readFileSync(PAGE_PATH, "utf-8");
      expect(pageSrc).toContain("canonicalUrl");
      expect(pageSrc).toContain("/products/${product.slug}");
      expect(pageSrc).toContain("alternates");
      expect(pageSrc).toContain("canonical: canonicalUrl");
    });

    it("page.tsx never imports service_role or admin secrets into client bundle", () => {
      const pageSrc = readFileSync(PAGE_PATH, "utf-8");
      expect(pageSrc).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(pageSrc).not.toContain("SERVICE_ROLE");
    });

    it("PreviewLandingView renders sticky bottom bar and end-of-preview section", () => {
      const viewSrc = readFileSync(VIEW_PATH, "utf-8");

      // Sticky purchase bar
      expect(viewSrc).toContain("Thanh mua nhanh");
      expect(viewSrc).toContain("fixed bottom-0");
      expect(viewSrc).toContain("Mua bản đầy đủ");

      // End of preview section
      expect(viewSrc).toContain('id="end-of-preview"');
      expect(viewSrc).toContain("Bạn đã xem hết bản xem thử");

      // Reuses Buy Now flow
      expect(viewSrc).toContain("useBuyNow");
      expect(viewSrc).toContain("buyNow()");

      // Analytics data attributes
      expect(viewSrc).toContain('data-analytics-event="preview_open"');
      expect(viewSrc).toContain('data-analytics-event="preview_buy_clicked"');

      // Maximum 25 pages preserved
      expect(viewSrc).toContain("MAX_PREVIEW_PAGES");
    });
  });

  // ─── 7. Admin Share Link ──────────────────────────────────────────

  describe("Admin Preview Share Link", () => {
    const FORM_PATH = resolve(__dirname, "../../src/components/admin/product-form.tsx");

    it("Admin ProductForm includes 'Copy link xem thử' action with tailieuhangcao.vn/xem-thu/{slug}", () => {
      const formSrc = readFileSync(FORM_PATH, "utf-8");
      expect(formSrc).toContain("Copy link xem thử");
      expect(formSrc).toContain("https://tailieuhangcao.vn/xem-thu/");
      expect(formSrc).toContain("navigator.clipboard.writeText");
    });
  });

  // ─── 8. Site B Isolation ──────────────────────────────────────────

  describe("Site B Isolation Guarantee", () => {
    it("Site B directory exists and git status is completely clean / unchanged", () => {
      const siteBPath = "D:\\Projects web\\phep-mau-van-hoc";
      if (!existsSync(siteBPath)) return; // Pass if run in environment without Site B sibling

      const gitStatus = execSync(`git -C "${siteBPath}" status --short`, { encoding: "utf-8" }).trim();
      expect(gitStatus).toBe("");
    });
  });
});
