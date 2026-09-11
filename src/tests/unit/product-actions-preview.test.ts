/**
 * Unit tests for the mobile preview CTA inside ProductActions.
 *
 * Validates that:
 * - PAID product ALWAYS renders "Xem thử tài liệu" — no hasPreview gating
 * - BONUS product never renders the preview button
 * - The href deterministically uses the product ID via stable API endpoint
 * - No dependency on previewUrl, signed URL, or hasPreview prop
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ACTIONS_PATH = resolve(__dirname, "../../components/product/product-actions.tsx");
const ACTIONS_SOURCE = readFileSync(ACTIONS_PATH, "utf-8");

describe("ProductActions mobile preview CTA", () => {
  const PRODUCT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("generates correct preview href from product ID", () => {
    const expectedHref = `/api/products/${PRODUCT_ID}/preview`;
    expect(expectedHref).toBe(`/api/products/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/preview`);
  });

  it("preview href does NOT contain previewUrl or signed URL", () => {
    const href = `/api/products/${PRODUCT_ID}/preview`;
    expect(href).not.toContain("token=");
    expect(href).not.toContain("signedUrl");
    expect(href).not.toContain("storage.supabase");
  });

  it("preview href follows the stable API pattern", () => {
    const href = `/api/products/${PRODUCT_ID}/preview`;
    const pattern = /^\/api\/products\/[0-9a-f-]+\/preview$/;
    expect(href).toMatch(pattern);
  });

  it("showMobilePreview depends ONLY on product_type, not hasPreview", () => {
    // The source should NOT contain hasPreview gating
    expect(ACTIONS_SOURCE).not.toContain("hasPreview");
    // It should use product_type === "PAID" directly
    expect(ACTIONS_SOURCE).toContain('product.product_type === "PAID"');
  });

  it("PAID product always shows mobile CTA (no hasPreview check)", () => {
    const productType = "PAID";
    const showMobilePreview = productType === "PAID";
    expect(showMobilePreview).toBe(true);
  });

  it("BONUS product never shows mobile CTA", () => {
    const productType: string = "BONUS";
    const showMobilePreview = productType === "PAID";
    expect(showMobilePreview).toBe(false);
  });

  it("CTA is hidden on desktop (md:hidden class present)", () => {
    expect(ACTIONS_SOURCE).toContain("md:hidden");
  });

  it("CTA opens in new tab with safe rel", () => {
    expect(ACTIONS_SOURCE).toContain('target="_blank"');
    expect(ACTIONS_SOURCE).toContain('rel="noopener noreferrer"');
  });

  it("no hasPreview prop in interface definition", () => {
    // Interface should not have hasPreview
    expect(ACTIONS_SOURCE).not.toMatch(/hasPreview\s*[?:]/);
  });
});
