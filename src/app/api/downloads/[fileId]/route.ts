/**
 * Download API route.
 *
 * POST /api/downloads/[fileId]
 *
 * Validates delivery authorization and generates a short-lived
 * signed URL for the requested product file.
 *
 * Authorization chain:
 * 1. Delivery access cookie → download token ID + order ID
 * 2. Download token → valid, not expired, not revoked, count < max
 * 3. Order → status is PAID
 * 4. File → belongs to a product in this order (ownership)
 * 5. Atomic download count increment via consume_download() RPC
 * 6. Generate signed URL (60s TTL)
 *
 * SECURITY:
 * - File ID is safe (UUID), not storage_path
 * - storage_path resolved from DB, never from client
 * - Signed URL is never stored or logged
 * - Uses POST to prevent trivial CSRF via GET
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDeliveryAccessCookie } from "@/lib/auth/delivery-access";
import { processDownload } from "@/features/downloads/service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: "File ID không hợp lệ." },
        { status: 400 },
      );
    }

    // 1. Read delivery access cookie — we need to find orderId to verify
    // Since we don't know orderId from the URL, we read cookie without orderId check
    // and let processDownload validate ownership
    const cookieStore = await import("next/headers").then(m => m.cookies());
    const deliveryCookie = cookieStore.get("delivery_access");

    if (!deliveryCookie?.value) {
      return NextResponse.json(
        { success: false, error: "Phiên tải tài liệu không hợp lệ. Vui lòng truy cập lại từ email." },
        { status: 403 },
      );
    }

    // Parse the cookie payload to extract downloadTokenId and orderId
    const [payloadStr] = deliveryCookie.value.split(".");
    if (!payloadStr) {
      return NextResponse.json(
        { success: false, error: "Phiên tải tài liệu không hợp lệ." },
        { status: 403 },
      );
    }

    let payload: { dtid: string; oid: string; exp: number };
    try {
      payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8"));
    } catch {
      return NextResponse.json(
        { success: false, error: "Phiên tải tài liệu không hợp lệ." },
        { status: 403 },
      );
    }

    // Verify the cookie signature properly
    const deliveryAccess = await getDeliveryAccessCookie(payload.oid);
    if (!deliveryAccess) {
      return NextResponse.json(
        { success: false, error: "Phiên tải tài liệu không hợp lệ hoặc đã hết hạn." },
        { status: 403 },
      );
    }

    // 2. Process the download
    const supabaseAdmin = getSupabaseAdmin();
    const result = await processDownload(
      deliveryAccess.downloadTokenId,
      deliveryAccess.orderId,
      fileId,
      supabaseAdmin,
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 403 },
      );
    }

    // Return signed URL — client will redirect to it
    return NextResponse.json({
      success: true,
      signedUrl: result.signedUrl,
      fileName: result.fileName,
    });
  } catch (error) {
    console.error("[Download] Error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
