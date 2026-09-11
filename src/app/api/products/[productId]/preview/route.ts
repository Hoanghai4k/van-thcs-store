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
      // Friendly customer-facing page — no raw JSON on mobile
      return new NextResponse(
        `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xem trước chưa sẵn sàng</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#374151;text-align:center;padding:1rem}
.card{max-width:400px}.icon{font-size:3rem;margin-bottom:1rem}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0 0 1.5rem;color:#6b7280;font-size:.875rem}
a{display:inline-block;padding:.625rem 1.25rem;background:#4f46e5;color:#fff;border-radius:.5rem;text-decoration:none;font-size:.875rem;font-weight:600}</style></head>
<body><div class="card"><div class="icon">📄</div><h1>Bản xem thử hiện chưa sẵn sàng</h1>
<p>Bản xem trước của tài liệu này đang được chuẩn bị. Vui lòng quay lại sau.</p>
<a href="javascript:history.back()">← Quay lại</a></div></body></html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
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
