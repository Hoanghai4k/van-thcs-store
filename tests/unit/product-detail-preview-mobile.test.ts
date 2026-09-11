/**
 * Product Detail — Mobile Preview Visibility Regression Test
 *
 * This test validates the Product Detail page composition to ensure:
 * 1. The PDF preview section exists in the page source
 * 2. The preview section has its OWN grid item (not buried inside another section)
 * 3. The preview's grid order places it BEFORE the description on mobile
 * 4. There is exactly ONE ProductPdfPreview usage (no duplicate desktop/mobile trees)
 * 5. The preview section is NOT wrapped in desktop-only visibility classes
 *
 * Root cause this test prevents:
 *   The preview was previously inside the same grid item as description (order-3),
 *   placing it AFTER description on mobile. Users scrolling through 1000+ px of
 *   purchase card content never discovered the preview section buried below.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PAGE_SOURCE = readFileSync(
  resolve(__dirname, "../../src/app/(store)/products/[slug]/page.tsx"),
  "utf-8",
);

describe("Product Detail — Mobile Preview Visibility", () => {
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

  it("preview section is NOT wrapped in desktop-only visibility classes", () => {
    // Extract the line(s) containing ProductPdfPreview and nearby parent context
    const lines = PAGE_SOURCE.split("\n");
    const previewLineIdx = lines.findIndex((l) => l.includes("<ProductPdfPreview"));
    expect(previewLineIdx).toBeGreaterThan(-1);

    // Check the 15 lines BEFORE the preview for desktop-only hiding patterns
    const contextBefore = lines
      .slice(Math.max(0, previewLineIdx - 15), previewLineIdx + 1)
      .join("\n");

    // These patterns would hide the section on mobile
    const desktopOnlyPatterns = [
      /className="[^"]*hidden\s+(?:md|lg|xl):(?:block|flex|grid)/,
      /className="[^"]*(?:md|lg|xl):hidden/,
    ];

    for (const pattern of desktopOnlyPatterns) {
      expect(
        contextBefore,
        `Preview parent context should not contain desktop-only visibility class: ${pattern}`,
      ).not.toMatch(pattern);
    }
  });

  it("preview section has its OWN grid item — not inside the description grid item", () => {
    const lines = PAGE_SOURCE.split("\n");

    // Find the preview component line
    const previewLineIdx = lines.findIndex((l) => l.includes("<ProductPdfPreview"));
    expect(previewLineIdx).toBeGreaterThan(-1);

    // Find the description heading line
    const descriptionLineIdx = lines.findIndex((l) => l.includes("Mô tả chi tiết"));
    expect(descriptionLineIdx).toBeGreaterThan(-1);

    // The preview must NOT be inside the same grid item as description.
    // We detect this by checking that the preview comes BEFORE the description
    // in the source (meaning it's in an earlier grid item with a lower order).
    expect(
      previewLineIdx,
      "Preview section must appear BEFORE description in source to ensure earlier mobile order",
    ).toBeLessThan(descriptionLineIdx);
  });

  it("preview grid item uses an order value LOWER than description grid item", () => {
    const lines = PAGE_SOURCE.split("\n");

    // Find the preview's grid item
    const previewLineIdx = lines.findIndex((l) => l.includes("<ProductPdfPreview"));
    expect(previewLineIdx).toBeGreaterThan(-1);

    // Walk backwards to find the nearest grid item (div with order-N class)
    let previewOrder: number | null = null;
    for (let i = previewLineIdx; i >= 0; i--) {
      const orderMatch = lines[i].match(/order-(\d+)/);
      if (orderMatch) {
        previewOrder = parseInt(orderMatch[1], 10);
        break;
      }
    }
    expect(previewOrder, "Preview must be inside a grid item with an order class").not.toBeNull();

    // Find description's grid item
    const descLineIdx = lines.findIndex((l) => l.includes("Mô tả chi tiết"));
    expect(descLineIdx).toBeGreaterThan(-1);

    let descOrder: number | null = null;
    for (let i = descLineIdx; i >= 0; i--) {
      const orderMatch = lines[i].match(/order-(\d+)/);
      if (orderMatch) {
        descOrder = parseInt(orderMatch[1], 10);
        break;
      }
    }
    expect(descOrder, "Description must be inside a grid item with an order class").not.toBeNull();

    expect(
      previewOrder!,
      `Preview order (${previewOrder}) must be less than description order (${descOrder}) for mobile layout`,
    ).toBeLessThan(descOrder!);
  });

  it("preview is conditionally rendered for PAID products with previewUrl", () => {
    // The preview should only render for PAID products that have a preview
    expect(PAGE_SOURCE).toContain('product.product_type === "PAID"');
    expect(PAGE_SOURCE).toContain("previewUrl");
  });

  it("preview section has a unique id for mobile anchor/debug", () => {
    expect(PAGE_SOURCE).toContain('id="preview-section"');
  });

  it("the grid uses grid-cols-1 on mobile (no multi-column hiding)", () => {
    expect(PAGE_SOURCE).toMatch(/grid\s+grid-cols-1\s+lg:grid-cols-12/);
  });
});
