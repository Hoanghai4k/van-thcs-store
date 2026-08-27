/**
 * POST /api/admin/upload/complete
 *
 * Complete an R2 multipart upload and persist metadata.
 *
 * Validates:
 * - Admin session
 * - Session token signature (HMAC)
 * - All part ETags received
 *
 * Actions:
 * 1. CompleteMultipartUpload to R2
 * 2. HEAD object to verify size/key
 * 3. Persist product_files row with storage_provider = 'R2'
 * 4. Sync product file count
 * 5. Invalidate existing preview
 */

import { NextRequest, NextResponse } from "next/server";
import { CompleteMultipartUploadCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentAdmin } from "@/lib/auth/admin-auth";
import { getR2Client, getR2BucketName } from "@/lib/storage/r2-client";
import { R2ProductFileStorage } from "@/lib/storage/provider";
import { verifyUploadSession } from "@/lib/storage/upload-session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { syncProductFileCount } from "@/features/products/actions";
import { STORAGE_BUCKETS, StorageProvider } from "@/lib/constants";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  // 1. Admin auth
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: {
    sessionToken: string;
    parts: Array<{ partNumber: number; etag: string }>;
    fileName: string;
    mimeType: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { sessionToken, parts, fileName, mimeType } = body;

  if (!sessionToken || !parts || !Array.isArray(parts) || !fileName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 3. Verify session token
  const session = verifyUploadSession(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "Phiên tải lên không hợp lệ." }, { status: 403 });
  }

  // 4. Verify all parts present
  if (parts.length !== session.totalParts) {
    return NextResponse.json(
      { error: `Cần ${session.totalParts} phần, nhận được ${parts.length}.` },
      { status: 400 },
    );
  }

  const r2 = getR2Client();
  const bucket = getR2BucketName();

  try {
    // 5. Complete multipart upload
    await r2.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: session.objectKey,
        UploadId: session.uploadId,
        MultipartUpload: {
          Parts: parts
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({
              PartNumber: p.partNumber,
              ETag: p.etag,
            })),
        },
      }),
    );

    // 6. HEAD to verify object
    const headResult = await r2.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: session.objectKey,
      }),
    );

    const actualSize = headResult.ContentLength ?? 0;

    // Allow small variance for multipart padding, but reject large mismatches
    const sizeTolerance = 0.01; // 1%
    if (Math.abs(actualSize - session.fileSize) > session.fileSize * sizeTolerance && actualSize !== session.fileSize) {
      console.error(
        `[Upload/Complete] Size mismatch: expected=${session.fileSize} actual=${actualSize}`,
      );
      // Cleanup orphan object
      const r2Storage = new R2ProductFileStorage();
      await r2Storage.deleteObject(session.objectKey).catch(() => {});
      return NextResponse.json(
        { error: "Tệp tải lên không hoàn chỉnh. Vui lòng thử lại." },
        { status: 400 },
      );
    }

    // 7. Persist metadata in DB
    const supabase = await getSupabaseServerClient();

    const { data: fileRecord, error: insertError } = await supabase
      .from("product_files")
      .insert({
        product_id: session.productId,
        file_name: fileName,
        storage_path: session.objectKey,
        file_size: session.fileSize,
        mime_type: mimeType || "application/octet-stream",
        storage_provider: StorageProvider.R2,
      })
      .select()
      .single();

    if (insertError || !fileRecord) {
      console.error("[Upload/Complete] DB insert error:", insertError?.message);
      // Cleanup orphan R2 object
      const r2Storage = new R2ProductFileStorage();
      await r2Storage.deleteObject(session.objectKey).catch(() => {});
      return NextResponse.json(
        { error: "Không thể lưu thông tin tệp." },
        { status: 500 },
      );
    }

    // 8. Sync file count
    await syncProductFileCount(session.productId);

    // 9. Invalidate existing preview
    const { data: existingPreview } = await supabase
      .from("product_previews")
      .select("id, storage_path")
      .eq("product_id", session.productId)
      .maybeSingle();

    if (existingPreview) {
      await supabase.storage
        .from(STORAGE_BUCKETS.PRODUCT_PREVIEWS)
        .remove([existingPreview.storage_path]);
      await supabase
        .from("product_previews")
        .delete()
        .eq("id", existingPreview.id);
    }

    revalidatePath(`/admin/products/${session.productId}`);

    return NextResponse.json({
      success: true,
      file: fileRecord,
    });
  } catch (err) {
    console.error("[Upload/Complete] Error:", err);
    return NextResponse.json(
      { error: "Không thể hoàn tất tải lên." },
      { status: 500 },
    );
  }
}
