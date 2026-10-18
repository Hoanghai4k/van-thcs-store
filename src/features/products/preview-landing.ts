/**
 * Preview Landing — server-side data loader.
 *
 * Powers the public preview-first sales funnel at /xem-thu/[slug].
 *
 * Reuses the EXISTING secure preview architecture (same as
 * GET /api/products/[productId]/preview):
 * - product_previews rows + the private "product-previews" bucket are only
 *   reachable with the server-side admin client (anon has no grants)
 * - the browser receives ONLY a short-lived signed URL for the derived
 *   preview PDF (max MAX_PREVIEW_PAGES pages, enforced at generation time
 *   and by a DB CHECK constraint)
 *
 * SECURITY:
 * - Never reads product_files or the product-files bucket
 * - Never returns storage_path, master DOCX/ZIP URLs or file identifiers
 * - Returns a whitelisted DTO — never the raw DB row
 * - Server-only: imports the Supabase admin client. NEVER import this
 *   module from a Client Component.
 */

import { cache } from "react";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MAX_PREVIEW_PAGES, STORAGE_BUCKETS } from "@/lib/constants";
import { getProductBySlug, getProductRelations } from "./queries";
import { clampPreviewPageCount, MAX_PRODUCT_SLUG_LENGTH, PRODUCT_SLUG_REGEX } from "./preview-landing-utils";
import type { ProductWithCategory } from "./types";

/**
 * Signed URL lifetime for the landing viewer.
 * Short-lived, but long enough for react-pdf to finish streaming the
 * preview PDF on slow mobile connections (range requests).
 */
export const PREVIEW_LANDING_SIGNED_URL_TTL_SECONDS = 600;

const PREVIEW_PDF_MIME = "application/pdf";

export const previewSlugSchema = z
  .string()
  .min(1)
  .max(MAX_PRODUCT_SLUG_LENGTH)
  .regex(PRODUCT_SLUG_REGEX);

/** Whitelisted, browser-safe product metadata for the landing page. */
export interface PreviewLandingProduct {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number;
  original_price: number | null;
  page_count: number | null;
  file_count: number;
  file_format: string;
  thumbnail_path: string | null;
  product_type: "PAID";
}

export interface PreviewLandingPreview {
  /** Short-lived signed URL of the derived preview PDF (never the master file). */
  url: string;
  /** Pages in the preview artifact, always <= MAX_PREVIEW_PAGES. */
  pageCount: number;
}

export interface PreviewLandingData {
  product: PreviewLandingProduct;
  preview: PreviewLandingPreview | null;
  hasBonus: boolean;
}

export function toPreviewLandingProduct(product: ProductWithCategory): PreviewLandingProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    short_description: product.short_description,
    price: product.price,
    original_price: product.original_price,
    page_count: product.page_count,
    file_count: product.file_count,
    file_format: product.file_format,
    thumbnail_path: product.thumbnail_path,
    product_type: "PAID",
  };
}

/**
 * Load safe product metadata for an active PAID product by slug.
 * Memoized per request (shared by generateMetadata + page render).
 */
export const getPreviewLandingProduct = cache(
  async (slug: string): Promise<PreviewLandingProduct | null> => {
    const parsed = previewSlugSchema.safeParse(slug);
    if (!parsed.success) return null;

    // Existing storefront query: is_active = true AND product_type = PAID
    const product = await getProductBySlug(parsed.data);
    if (!product || !product.is_active || product.product_type !== "PAID") {
      return null;
    }

    return toPreviewLandingProduct(product);
  },
);

/**
 * Create a short-lived signed URL for the product's derived preview PDF.
 * Returns null (friendly fallback) when no usable preview exists.
 */
export async function getPreviewLandingPreview(
  productId: string,
): Promise<PreviewLandingPreview | null> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: preview, error } = await supabase
      .from("product_previews")
      .select("storage_path, page_count, mime_type")
      .eq("product_id", productId)
      .maybeSingle();

    if (error || !preview) return null;

    // Defense in depth: only ever hand out the derived PDF artifact.
    if (preview.mime_type !== PREVIEW_PDF_MIME) {
      console.error("[PreviewLanding] Preview artifact is not a PDF — refusing to serve.");
      return null;
    }

    const pageCount = clampPreviewPageCount(preview.page_count, MAX_PREVIEW_PAGES);
    if (pageCount < 1) return null;

    const { data: signed, error: signError } = await supabase.storage
      .from(STORAGE_BUCKETS.PRODUCT_PREVIEWS)
      .createSignedUrl(preview.storage_path, PREVIEW_LANDING_SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      console.error("[PreviewLanding] Failed to create signed preview URL.");
      return null;
    }

    return { url: signed.signedUrl, pageCount };
  } catch {
    console.error("[PreviewLanding] Unexpected error while loading preview.");
    return null;
  }
}

/** Whether the PAID product ships with BONUS products (names/files are NOT exposed). */
async function hasIncludedBonus(productId: string): Promise<boolean> {
  try {
    const relations = await getProductRelations(productId);
    return relations.bonusIncluded.length > 0;
  } catch {
    return false;
  }
}

/**
 * Full landing payload: safe product DTO + optional signed preview + bonus flag.
 * Returns null when the slug does not map to an active PAID product.
 */
export async function getPreviewLandingData(slug: string): Promise<PreviewLandingData | null> {
  const product = await getPreviewLandingProduct(slug);
  if (!product) return null;

  const [preview, hasBonus] = await Promise.all([
    getPreviewLandingPreview(product.id),
    hasIncludedBonus(product.id),
  ]);

  return { product, preview, hasBonus };
}
