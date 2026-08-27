/**
 * POST /api/admin/upload/sign-part
 *
 * Generate a presigned PUT URL for one multipart part.
 * Browser uploads the part chunk directly to R2 using this URL.
 *
 * Validates:
 * - Admin session
 * - Session token signature (HMAC)
 * - Part number is within expected range
 *
 * Returns:
 * - presignedUrl (short-lived PUT URL for this part)
 */

import { NextRequest, NextResponse } from "next/server";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCurrentAdmin } from "@/lib/auth/admin-auth";
import { getR2Client, getR2BucketName } from "@/lib/storage/r2-client";
import { verifyUploadSession } from "@/lib/storage/upload-session";

/** Presigned part URL lifetime: 15 minutes */
const PART_URL_TTL_SECONDS = 900;

export async function POST(request: NextRequest) {
  // 1. Admin auth
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: { sessionToken: string; partNumber: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { sessionToken, partNumber } = body;

  if (!sessionToken || typeof partNumber !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 3. Verify session token
  const session = verifyUploadSession(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "Phiên tải lên không hợp lệ." }, { status: 403 });
  }

  // 4. Validate part number
  if (partNumber < 1 || partNumber > session.totalParts) {
    return NextResponse.json(
      { error: `Số phần không hợp lệ. Phạm vi: 1-${session.totalParts}` },
      { status: 400 },
    );
  }

  // 5. Generate presigned PUT URL
  const r2 = getR2Client();
  const bucket = getR2BucketName();

  try {
    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: session.objectKey,
      UploadId: session.uploadId,
      PartNumber: partNumber,
    });

    const presignedUrl = await getSignedUrl(r2, command, {
      expiresIn: PART_URL_TTL_SECONDS,
    });

    return NextResponse.json({ presignedUrl });
  } catch (err) {
    console.error("[Upload/SignPart] Presign error:", err);
    return NextResponse.json(
      { error: "Không thể tạo URL tải lên." },
      { status: 500 },
    );
  }
}
