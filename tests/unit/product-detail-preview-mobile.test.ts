/**
 * Product Detail — Preview Section Regression Tests
 *
 * Validates:
 * 1. Preview section heading is server-rendered (not inside a dynamic import)
 * 2. Desktop: embedded ProductPdfPreview viewer (hidden md:block)
 * 3. Mobile: preview CTA lives in the purchase card (ProductActions), NOT in a separate section
 * 4. Preview appears BEFORE description in JSX source order
 * 5. No CSS order-* tricks — DOM source order = mobile render order
 * 6. Single conditional branch — no duplicate desktop/mobile data fetching
 * 7. BONUS products never get preview
 * 8. Preview URL is never the full source file
 * 9. Mobile CTA uses stable API endpoint, not a signed URL
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PAGE_PATH = resolve(__dirname, "../../src/app/(store)/products/[slug]/page.tsx");
const PAGE_SOURCE = readFileSync(PAGE_PATH, "utf-8");

const ACTIONS_PATH = resolve(__dirname, "../../src/components/product/product-actions.tsx");
const ACTIONS_SOURCE = readFileSync(ACTIONS_PATH, "utf-8");

describe("Product Detail — Preview Section", () => {

  // ─── Server-rendered outer section ─────────────────────────────────

  it("'Xem trước tài liệu' heading exists in the page source (server-rendered)", () => {
    expect(PAGE_SOURCE).toContain("Xem trước tài liệu");
  });

  it("preview heading is NOT inside a dynamically imported component", () => {
    // The heading text must be in page.tsx, not buried inside product-pdf-preview
    const previewCompSource = readFileSync(
      resolve(__dirname, "../../src/components/product/product-pdf-preview.tsx"),
      "utf-8",
    );
    expect(previewCompSource).not.toContain("Xem trước tài liệu");
  });

  it("preview section has a unique id for anchor navigation", () => {
    expect(PAGE_SOURCE).toContain('id="preview-section"');
  });

  // ─── Desktop: embedded react-pdf viewer ────────────────────────────

  it("desktop uses embedded ProductPdfPreview (hidden md:block)", () => {
    expect(PAGE_SOURCE).toContain("<ProductPdfPreview");
    // The desktop wrapper should be hidden on mobile, shown on md+
    expect(PAGE_SOURCE).toContain('hidden md:block');
  });

  it("ProductPdfPreview import exists", () => {
    expect(PAGE_SOURCE).toContain(
      'import { ProductPdfPreview } from "@/components/product/product-pdf-preview"',
    );
  });

  // ─── Mobile: CTA in purchase card (ProductActions) ─────────────────

  it("mobile preview CTA is inside ProductActions, not a separate section", () => {
    // ProductActions should contain the "Xem thử tài liệu" CTA
    expect(ACTIONS_SOURCE).toContain("Xem thử tài liệu");
    // And the old MobilePreviewCard should NOT be imported in page.tsx
    expect(PAGE_SOURCE).not.toContain("MobilePreviewCard");
    expect(PAGE_SOURCE).not.toContain("mobile-preview-card");
  });

  it("ProductActions does NOT gate mobile CTA on hasPreview (unconditional for PAID)", () => {
    // hasPreview prop should be fully removed from both page and actions
    expect(PAGE_SOURCE).not.toContain("hasPreview");
    expect(ACTIONS_SOURCE).not.toContain("hasPreview");
  });

  it("mobile CTA uses the stable API endpoint, not a previewUrl prop", () => {
    // ProductActions should link to the API endpoint using product.id
    expect(ACTIONS_SOURCE).toContain("/api/products/");
    expect(ACTIONS_SOURCE).toContain("/preview");
    // And must NOT depend on a url/previewUrl prop
    expect(ACTIONS_SOURCE).not.toMatch(/href=\{.*previewUrl/);
  });

  it("mobile CTA opens link in new tab safely", () => {
    expect(ACTIONS_SOURCE).toContain('target="_blank"');
    expect(ACTIONS_SOURCE).toContain('rel="noopener noreferrer"');
  });

  it("mobile CTA is hidden on desktop (md:hidden)", () => {
    expect(ACTIONS_SOURCE).toContain("md:hidden");
  });

  it("mobile CTA does NOT import react-pdf", () => {
    expect(ACTIONS_SOURCE).not.toMatch(/import\s.*from\s+["']react-pdf["']/);
    expect(ACTIONS_SOURCE).not.toMatch(/import\s.*from\s+["']pdfjs/);
    expect(ACTIONS_SOURCE).not.toContain("pdfjs.GlobalWorkerOptions");
  });

  // ─── Source order ──────────────────────────────────────────────────

  it("preview appears BEFORE description in JSX source order", () => {
    const previewIdx = PAGE_SOURCE.indexOf("Xem trước tài liệu");
    const descIdx = PAGE_SOURCE.indexOf("Mô tả chi tiết");
    expect(previewIdx).toBeGreaterThan(-1);
    expect(descIdx).toBeGreaterThan(-1);
    expect(previewIdx).toBeLessThan(descIdx);
  });

  it("does NOT use CSS order-* classes on preview or description grid items", () => {
    const lines = PAGE_SOURCE.split("\n");
    const previewIdx = lines.findIndex((l) => l.includes("<ProductPdfPreview"));
    const descIdx = lines.findIndex((l) => l.includes("Mô tả chi tiết"));

    const previewContext = lines.slice(Math.max(0, previewIdx - 10), previewIdx + 1).join("\n");
    const descContext = lines.slice(Math.max(0, descIdx - 10), descIdx + 1).join("\n");

    expect(previewContext).not.toMatch(/\border-\d+\b/);
    expect(descContext).not.toMatch(/\border-\d+\b/);
  });

  // ─── Security ──────────────────────────────────────────────────────

  it("mobile CTA never exposes full source paths", () => {
    expect(ACTIONS_SOURCE).not.toContain("product_files");
    expect(ACTIONS_SOURCE).not.toContain("product-files");
    expect(ACTIONS_SOURCE).not.toContain("service_role");
  });

  // ─── Data condition ───────────────────────────────────────────────

  it("preview is conditionally rendered for PAID products with previewUrl", () => {
    expect(PAGE_SOURCE).toContain('product.product_type === "PAID"');
    expect(PAGE_SOURCE).toContain("previewUrl");
  });

  it("previewUrl is derived from server-side getProductPreview (viewport-independent)", () => {
    expect(PAGE_SOURCE).toContain("getProductPreview");
    expect(PAGE_SOURCE).toContain("previewRecord");
  });

  // ─── Grid structure ───────────────────────────────────────────────

  it("the grid uses grid-cols-1 on mobile", () => {
    expect(PAGE_SOURCE).toMatch(/grid\s+grid-cols-1\s+lg:grid-cols-12/);
  });

  // ─── BONUS products ───────────────────────────────────────────────

  it("BONUS products are excluded by notFound() before preview logic", () => {
    // The page has a guard: if product_type === "BONUS" → notFound()
    expect(PAGE_SOURCE).toContain('product.product_type === "BONUS"');
    expect(PAGE_SOURCE).toContain("notFound()");
  });
});
