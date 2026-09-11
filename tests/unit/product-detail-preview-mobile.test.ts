/**
 * Product Detail — Mobile Preview Visibility Regression Test
 *
 * This test validates the Product Detail page composition to ensure:
 * 1. The PDF preview section exists in the page source
 * 2. The preview has its OWN grid item (sibling to description, not nested inside)
 * 3. The preview appears BEFORE description in JSX source order (= mobile render order)
 * 4. There is exactly ONE ProductPdfPreview usage (no duplicate desktop/mobile trees)
 * 5. The preview section is NOT wrapped in desktop-only visibility classes
 * 6. NO CSS order-* tricks are used — JSX source order IS mobile render order
 * 7. The grid parent uses grid-cols-1 on mobile (items are grid children)
 *
 * Root cause this test prevents:
 *   The preview was previously inside the same grid item as description,
 *   placed AFTER description in source order. On mobile (grid-cols-1),
 *   users scrolled through 1000+ px of content and never found the
 *   preview buried at the bottom. The fix extracts preview into its
 *   own grid item placed BEFORE description in source order.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PAGE_PATH = resolve(__dirname, "../../src/app/(store)/products/[slug]/page.tsx");
const PAGE_SOURCE = readFileSync(PAGE_PATH, "utf-8");
const PAGE_LINES = PAGE_SOURCE.split("\n");

describe("Product Detail — Mobile Preview Visibility", () => {

  // ─── Basic existence ───────────────────────────────────────────────

  it("page source contains the 'Xem trước tài liệu' heading", () => {
    expect(PAGE_SOURCE).toContain("Xem trước tài liệu");
  });

  it("page source contains ProductPdfPreview component usage", () => {
    expect(PAGE_SOURCE).toContain("<ProductPdfPreview");
  });

  it("ProductPdfPreview is used exactly ONCE (no duplicate desktop/mobile trees)", () => {
    const matches = PAGE_SOURCE.match(/<ProductPdfPreview/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it("preview import exists", () => {
    expect(PAGE_SOURCE).toContain(
      'import { ProductPdfPreview } from "@/components/product/product-pdf-preview"',
    );
  });

  // ─── Source order (= mobile render order) ──────────────────────────

  it("preview appears BEFORE description in JSX source order", () => {
    const previewIdx = PAGE_SOURCE.indexOf("Xem trước tài liệu");
    const descIdx = PAGE_SOURCE.indexOf("Mô tả chi tiết");

    expect(previewIdx).toBeGreaterThan(-1);
    expect(descIdx).toBeGreaterThan(-1);
    expect(
      previewIdx,
      "Preview must appear BEFORE description in source — source order IS mobile render order",
    ).toBeLessThan(descIdx);
  });

  it("preview is a sibling grid item, NOT nested inside description's grid item", () => {
    const previewLineIdx = PAGE_LINES.findIndex((l) => l.includes("<ProductPdfPreview"));
    const descLineIdx = PAGE_LINES.findIndex((l) => l.includes("Mô tả chi tiết"));

    expect(previewLineIdx).toBeGreaterThan(-1);
    expect(descLineIdx).toBeGreaterThan(-1);

    // Preview must be in a SEPARATE grid item — verify there is a closing </div>
    // between preview and description at the grid-item level
    const betweenLines = PAGE_LINES.slice(previewLineIdx, descLineIdx).join("\n");
    // The preview's grid wrapper should close before description starts
    expect(betweenLines).toContain("</div>");
  });

  // ─── No CSS order tricks ──────────────────────────────────────────

  it("does NOT use CSS order-* classes on grid items containing preview or description", () => {
    const previewLineIdx = PAGE_LINES.findIndex((l) => l.includes("<ProductPdfPreview"));
    const descLineIdx = PAGE_LINES.findIndex((l) => l.includes("Mô tả chi tiết"));

    // Check 10 lines before preview for order-* on the grid item wrapper
    const previewContext = PAGE_LINES.slice(
      Math.max(0, previewLineIdx - 10),
      previewLineIdx + 1,
    ).join("\n");

    // Check 10 lines before description for order-* on the grid item wrapper
    const descContext = PAGE_LINES.slice(
      Math.max(0, descLineIdx - 10),
      descLineIdx + 1,
    ).join("\n");

    // Neither preview nor description grid items should rely on CSS order
    const orderPattern = /\border-\d+\b/;
    expect(
      previewContext,
      "Preview grid item should NOT use CSS order-* classes",
    ).not.toMatch(orderPattern);
    expect(
      descContext,
      "Description grid item should NOT use CSS order-* classes",
    ).not.toMatch(orderPattern);
  });

  // ─── No desktop-only visibility ───────────────────────────────────

  it("preview is NOT wrapped in desktop-only visibility classes", () => {
    const previewLineIdx = PAGE_LINES.findIndex((l) => l.includes("<ProductPdfPreview"));
    const contextBefore = PAGE_LINES
      .slice(Math.max(0, previewLineIdx - 15), previewLineIdx + 1)
      .join("\n");

    const desktopOnlyPatterns = [
      /className="[^"]*hidden\s+(?:md|lg|xl):(?:block|flex|grid)/,
      /className="[^"]*(?:md|lg|xl):hidden/,
    ];

    for (const pattern of desktopOnlyPatterns) {
      expect(contextBefore).not.toMatch(pattern);
    }
  });

  // ─── Grid structure ───────────────────────────────────────────────

  it("the grid uses grid-cols-1 on mobile", () => {
    expect(PAGE_SOURCE).toMatch(/grid\s+grid-cols-1\s+lg:grid-cols-12/);
  });

  it("preview section has a unique id for anchor navigation", () => {
    expect(PAGE_SOURCE).toContain('id="preview-section"');
  });

  // ─── Data condition ───────────────────────────────────────────────

  it("preview is conditionally rendered for PAID products with previewUrl", () => {
    expect(PAGE_SOURCE).toContain('product.product_type === "PAID"');
    expect(PAGE_SOURCE).toContain("previewUrl");
  });

  it("previewUrl is derived from server-side getProductPreview (viewport-independent)", () => {
    expect(PAGE_SOURCE).toContain("getProductPreview");
    expect(PAGE_SOURCE).toContain("previewRecord");
    // Ensure no viewport/mobile conditional around the data fetch
    expect(PAGE_SOURCE).not.toMatch(/isMobile.*getProductPreview|getProductPreview.*isMobile/);
  });
});
