/**
 * Download API route.
 *
 * Validates the download token and serves the file if all checks pass.
 *
 * Checks (in order):
 * 1. Token exists
 * 2. Token not expired
 * 3. Order is PAID
 * 4. Product belongs to order
 * 5. Download count within limit
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAndGetDownload } from "@/features/downloads/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token không hợp lệ" },
        { status: 400 },
      );
    }

    const result = await validateAndGetDownload(token);

    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 403 },
      );
    }

    // TODO: When Supabase storage is configured:
    // 1. Generate signed URL from Supabase Storage
    // 2. Increment download count
    // 3. Redirect to signed URL or stream the file

    return NextResponse.json(
      {
        success: false,
        error: "Download service chưa được cấu hình hoàn chỉnh.",
      },
      { status: 503 },
    );
  } catch (error) {
    console.error("[Download] Error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống" },
      { status: 500 },
    );
  }
}
