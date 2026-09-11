/**
 * Product Preview API route.
 *
 * GET /api/products/[productId]/preview
 *
 * Generates a short-lived signed URL for the derived preview PDF
 * and redirects the browser to it. Used by the mobile "Xem thử tài liệu"
 * button in the purchase card.
 *
 * Flow:
 * 1. Validate productId (UUID)
 * 2. Load product → must be active + PAID
 * 3. Load product_previews row
 * 4. Create signed URL (60s) for the product-previews bucket
 * 5. Redirect (302) to the signed URL
 *
 * SECURITY:
 * - Uses admin client server-side only
 * - Never exposes storage_path, full DOCX, ZIP, or service role key
 * - Only the derived preview PDF (max 25 pages) is accessible
 * - No login required — this is a public product preview
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { STORAGE_BUCKETS } from "@/lib/constants";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { productId } = await params;

    // 1. Validate UUID format
    if (!productId || !UUID_REGEX.test(productId)) {
      return NextResponse.json(
        { success: false, error: "Sản phẩm không tồn tại." },
        { status: 404 },
      );
    }

    const supabase = getSupabaseAdmin();

    // 2. Load product — must be active and PAID
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, product_type, is_active")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: "Sản phẩm không tồn tại." },
        { status: 404 },
      );
    }

    if (!product.is_active) {
      return NextResponse.json(
        { success: false, error: "Sản phẩm không tồn tại." },
        { status: 404 },
      );
    }

    if (product.product_type !== "PAID") {
      return NextResponse.json(
        { success: false, error: "Sản phẩm không hỗ trợ xem trước." },
        { status: 404 },
      );
    }

    // 3. Load preview record
    const { data: preview, error: previewError } = await supabase
      .from("product_previews")
      .select("storage_path")
      .eq("product_id", productId)
      .maybeSingle();

    if (previewError || !preview) {
      return NextResponse.json(
        { success: false, error: "Bản xem trước chưa sẵn sàng." },
        { status: 404 },
      );
    }

    // 4. Create short-lived signed URL (60 seconds)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(STORAGE_BUCKETS.PRODUCT_PREVIEWS)
      .createSignedUrl(preview.storage_path, 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[Preview] Failed to create signed URL:", signedUrlError?.message);
      return NextResponse.json(
        { success: false, error: "Không thể tạo liên kết xem trước." },
        { status: 500 },
      );
    }

    // 5. Redirect to the signed preview PDF
    return NextResponse.redirect(signedUrlData.signedUrl, 302);
  } catch (error) {
    console.error("[Preview] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Đã xảy ra lỗi. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
