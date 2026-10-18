/**
 * Preview Landing — pure, client-safe helpers.
 *
 * Shared by:
 * - the public preview landing route (/xem-thu/[slug])
 * - the product detail mobile "Xem thử tài liệu" link
 * - the Admin "Copy link xem thử" action
 *
 * This module MUST stay free of server-only imports (Supabase admin
 * client, env secrets, storage paths) so it can be bundled in Client
 * Components.
 */

/** Public base path for the preview-first sales funnel. */
export const PREVIEW_LANDING_BASE_PATH = "/xem-thu";

/** Same slug format enforced by the product schema (features/products/schema.ts). */
export const PRODUCT_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Hard upper bound for slug length accepted by the public route. */
export const MAX_PRODUCT_SLUG_LENGTH = 200;

export function isValidProductSlug(slug: unknown): slug is string {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= MAX_PRODUCT_SLUG_LENGTH &&
    PRODUCT_SLUG_REGEX.test(slug)
  );
}

/** Relative path of the preview landing page for a product slug. */
export function getPreviewLandingPath(slug: string): string {
  return `${PREVIEW_LANDING_BASE_PATH}/${encodeURIComponent(slug)}`;
}

/** Absolute, shareable preview landing URL (for Facebook/Zalo posts). */
export function getPreviewLandingUrl(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/+$/, "")}${getPreviewLandingPath(slug)}`;
}

/** Relative path of the main Product Detail page (canonical URL). */
export function getProductDetailPath(slug: string): string {
  return `/products/${encodeURIComponent(slug)}`;
}

/**
 * Clamp the number of navigable preview pages.
 *
 * Defense in depth only: the stored preview artifact itself already
 * contains at most MAX_PREVIEW_PAGES pages (enforced by the generator
 * and a DB CHECK constraint). This never "hides" pages of a larger
 * document — it only guarantees the viewer UI can never exceed the cap.
 */
export function clampPreviewPageCount(numPages: number, maxPages?: number): number {
  const safe = Number.isFinite(numPages) ? Math.max(0, Math.floor(numPages)) : 0;
  if (maxPages === undefined) return safe;
  return Math.min(safe, Math.max(0, Math.floor(maxPages)));
}

/** Vietnamese thousands formatting: 1478 → "1.478". */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
}

/** Human label for products.file_format ("docx" | "zip" | "mixed"). */
export function formatFileFormatLabel(fileFormat: string | null | undefined): string {
  if (fileFormat === "zip") return "ZIP";
  if (fileFormat === "mixed") return "DOCX + ZIP";
  return "DOCX";
}

/** Discount percent when a compare-at price applies, else null. */
export function getDiscountPercent(
  price: number,
  originalPrice: number | null | undefined,
): number | null {
  if (!originalPrice || originalPrice <= price) return null;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

/**
 * Compact header sub-line, e.g.
 * "Xem trước 25 trang đầu • Bản đầy đủ 1.478 trang"
 */
export function buildPreviewSubtitle(params: {
  previewPageCount: number | null;
  maxPreviewPages: number;
  fullPageCount: number | null;
}): string {
  const { previewPageCount, maxPreviewPages, fullPageCount } = params;
  const parts: string[] = [];

  if (previewPageCount && previewPageCount > 0) {
    const shown = Math.min(previewPageCount, maxPreviewPages);
    parts.push(
      shown >= maxPreviewPages
        ? `Xem trước tối đa ${maxPreviewPages} trang đầu`
        : `Xem trước ${shown} trang đầu`,
    );
  } else {
    parts.push("Bản xem thử đang được cập nhật");
  }

  if (fullPageCount && fullPageCount > 0) {
    parts.push(`Bản đầy đủ ${formatCount(fullPageCount)} trang`);
  }

  return parts.join(" • ");
}

/**
 * End-of-preview summary, e.g.
 * "Bản đầy đủ gồm 1.478 trang và 3 tệp."
 * Uses real product metadata only — never hard-coded counts.
 */
export function buildFullVersionSummary(
  fullPageCount: number | null | undefined,
  fileCount: number | null | undefined,
): string {
  const hasPages = !!fullPageCount && fullPageCount > 0;
  const hasFiles = !!fileCount && fileCount > 0;

  if (hasPages && hasFiles) {
    return `Bản đầy đủ gồm ${formatCount(fullPageCount!)} trang và ${formatCount(fileCount!)} tệp.`;
  }
  if (hasPages) return `Bản đầy đủ gồm ${formatCount(fullPageCount!)} trang.`;
  if (hasFiles) return `Bản đầy đủ gồm ${formatCount(fileCount!)} tệp.`;
  return "Nhận trọn bộ tài liệu gốc ngay sau khi thanh toán.";
}
