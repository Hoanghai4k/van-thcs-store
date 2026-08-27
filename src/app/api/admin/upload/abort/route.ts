/**
 * POST /api/admin/upload/abort
 *
 * Abort an in-progress R2 multipart upload.
 * Cleans up incomplete upload parts from R2.
 *
 * Validates:
 * - Admin session
 * - Session token signature (HMAC)
 */

import { NextRequest, NextResponse } from "next/server";
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getCurrentAdmin } from "@/lib/auth/admin-auth";
import { getR2Client, getR2BucketName } from "@/lib/storage/r2-client";
import { verifyUploadSession } from "@/lib/storage/upload-session";

export async function POST(request: NextRequest) {
  // 1. Admin auth
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: { sessionToken: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { sessionToken } = body;

  if (!sessionToken) {
    return NextResponse.json({ error: "Missing sessionToken" }, { status: 400 });
  }

  // 3. Verify session token
  const session = verifyUploadSession(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "Phiên tải lên không hợp lệ." }, { status: 403 });
  }

  // 4. Abort multipart upload
  const r2 = getR2Client();
  const bucket = getR2BucketName();

  try {
    await r2.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: session.objectKey,
        UploadId: session.uploadId,
      }),
    );
  } catch (err) {
    // Log but don't fail — the upload may already be completed or expired
    console.warn("[Upload/Abort] R2 abort warning:", err);
  }

  return NextResponse.json({ success: true });
}
