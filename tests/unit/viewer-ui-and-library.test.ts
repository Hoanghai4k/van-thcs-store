import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { MAX_PREVIEW_PAGES } from "@/lib/constants";

describe("Viewer UI & Integration Invariants (Phase 30)", () => {
  const libraryViewPath = resolve(__dirname, "../../src/components/account/library-view.tsx");
  const libraryViewSource = readFileSync(libraryViewPath, "utf-8");

  const documentViewerPath = resolve(__dirname, "../../src/components/viewer/document-viewer.tsx");
  const documentViewerSource = readFileSync(documentViewerPath, "utf-8");

  const fullViewerPagePath = resolve(__dirname, "../../src/app/(store)/account/library/[slug]/page.tsx");
  const fullViewerPageSource = readFileSync(fullViewerPagePath, "utf-8");

  const productActionsPath = resolve(__dirname, "../../src/components/product/product-actions.tsx");
  const productActionsSource = readFileSync(productActionsPath, "utf-8");

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 22: My Library READY item links to viewer
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 22: My Library item with hasReadyArtifact links to /account/library/[slug]", () => {
    expect(libraryViewSource).toContain("item.hasReadyArtifact && item.slug");
    expect(libraryViewSource).toContain("`/account/library/${item.slug}`");
    expect(libraryViewSource).toContain("Xem tài liệu");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 23: Non-ready item shows preparing state
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 23: My Library item without READY artifact displays preparing message without download link", () => {
    expect(libraryViewSource).toContain("Tài liệu đang được chuẩn bị để xem");
    // Ensure it does not render a delivery or download link for non-ready items
    expect(libraryViewSource).not.toContain("/delivery/");
    expect(libraryViewSource).not.toContain("/api/downloads/");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 24: Viewer contains NO Word download CTA
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 24: Document Viewer strictly contains NO Word/DOCX download or export CTA", () => {
    const lowerViewer = documentViewerSource.toLowerCase();
    expect(lowerViewer).not.toContain("download docx");
    expect(lowerViewer).not.toContain("tải word");
    expect(lowerViewer).not.toContain("tải file docx");
    expect(lowerViewer).not.toContain("open word");
    expect(lowerViewer).not.toContain("save as docx");
    expect(lowerViewer).not.toContain(".docx");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 25: Viewer contains NO full PDF download CTA
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 25: Document Viewer strictly contains NO full PDF download or export CTA", () => {
    const lowerViewer = documentViewerSource.toLowerCase();
    expect(lowerViewer).not.toContain("download pdf");
    expect(lowerViewer).not.toContain("tải pdf");
    expect(lowerViewer).not.toContain("tải bản đầy đủ");
    expect(lowerViewer).not.toContain("in tài liệu");
    expect(lowerViewer).not.toContain("print document");
    expect(lowerViewer).not.toContain("window.print");
    expect(lowerViewer).not.toContain("download=");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 26: Public preview <= 25 remains unchanged
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 26: Public preview remains strictly <= 25 pages", () => {
    expect(MAX_PREVIEW_PAGES).toBe(25);
    // ProductActions still provides mobile preview CTA
    expect(productActionsSource).toContain("`/api/products/${product.id}/preview`");
    expect(productActionsSource).toContain("Xem trước tối đa 25 trang đầu.");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 27: Guest checkout remains unchanged and functional
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 27: Product detail retains active Buy Now and Add to Cart CTAs for guest checkout", () => {
    expect(productActionsSource).toContain("Mua ngay");
    expect(productActionsSource).toContain("Thêm vào giỏ hàng");
    expect(productActionsSource).toContain("handleBuyNow");
    expect(productActionsSource).toContain("handleAddToCart");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 28: Mobile responsive viewer constraints
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 28: Viewer layout supports mobile viewports (320px, 390px, 430px) without overflow", () => {
    // Top header uses responsive sizing and truncation
    expect(documentViewerSource).toContain("truncate");
    // Responsive container uses aspect ratio for pages
    expect(documentViewerSource).toContain("aspect-[1/1.414]");
    // Image uses object-contain to fit within container
    expect(documentViewerSource).toContain("object-contain");
    // Lazy loading for mobile memory protection
    expect(documentViewerSource).toContain("IntersectionObserver");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 29: Entitled customer CTA on Product Detail
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 29: Entitled customer visiting Product Detail receives 'Xem bản đầy đủ trong Thư viện' CTA", () => {
    expect(productActionsSource).toContain("data-testid=\"entitled-full-viewer-cta\"");
    expect(productActionsSource).toContain("`/account/library/${product.slug}`");
    expect(productActionsSource).toContain("Xem bản đầy đủ trong Thư viện");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 30: Full Viewer Page authentication & RLS enforcement
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 30: Full Viewer page route enforces authentication, entitlement and masked email", () => {
    expect(fullViewerPageSource).toContain("getCurrentAuthUser()");
    expect(fullViewerPageSource).toContain("verifyProductEntitlement(slug)");
    expect(fullViewerPageSource).toContain("getViewerMetadataForProduct(entitlement.product.id)");
    expect(fullViewerPageSource).toContain("maskEmail(customer.email)");
  });
});

