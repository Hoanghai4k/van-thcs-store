/**
 * POST /api/admin/upload/init
 *
 * Initialize an R2 multipart upload session.
 *
 * Validates:
 * - Admin session
 * - Product exists
 * - File extension, MIME type, size
 *
 * Returns:
 * - sessionToken (signed opaque token binding session to admin/product/key)
 * - objectKey (server-generated R2 key)
 * - partCount (number of parts to upload)
 *
 * Never returns R2 credentials.
 */

import { NextRequest, NextResponse } from "next/server";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getCurrentAdmin } from "@/lib/auth/admin-auth";
import { getR2Client, getR2BucketName } from "@/lib/storage/r2-client";
import { signUploadSession } from "@/lib/storage/upload-session";
import { validateProductFile } from "@/lib/storage/storage";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MAX_PRODUCT_FILE_SIZE, R2_PART_SIZE_BYTES } from "@/lib/constants";

export async function POST(request: NextRequest) {
  // 1. Admin auth
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: { productId: string; fileName: string; fileSize: number; mimeType: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { productId, fileName, fileSize, mimeType } = body;

  if (!productId || !fileName || !fileSize || !mimeType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 3. Validate file
  if (fileSize <= 0 || fileSize > MAX_PRODUCT_FILE_SIZE) {
    return NextResponse.json(
      { error: "Dung lượng tệp không hợp lệ hoặc vượt quá 1 GB." },
      { status: 400 },
    );
  }

  const validationError = validateProductFile(fileName, mimeType, fileSize);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // 4. Verify product exists
  const supabase = await getSupabaseServerClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: "Sản phẩm không tồn tại." }, { status: 404 });
  }

  // 5. Generate safe R2 object key
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const uuid = crypto.randomUUID();
  const objectKey = `products/${productId}/${uuid}.${ext}`;

  // 6. Create R2 multipart upload
  const r2 = getR2Client();
  const bucket = getR2BucketName();

  try {
    const createResult = await r2.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: mimeType,
      }),
    );

    if (!createResult.UploadId) {
      throw new Error("R2 did not return an UploadId");
    }

    const totalParts = Math.ceil(fileSize / R2_PART_SIZE_BYTES);

    // 7. Sign session token
    const sessionToken = signUploadSession({
      uploadId: createResult.UploadId,
      objectKey,
      productId,
      totalParts,
      fileSize,
    });

    return NextResponse.json({
      sessionToken,
      objectKey,
      uploadId: createResult.UploadId,
      partCount: totalParts,
      partSize: R2_PART_SIZE_BYTES,
    });
  } catch (error: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    // 1. CAPTURE THE FULL EPROTO ERROR
    console.error("[Upload/Init] R2 CreateMultipartUpload error:", {
      name: err?.name,
      code: err?.code,
      errno: err?.errno,
      syscall: err?.syscall,
      message: err?.message,
      causeMessage: err?.cause?.message,
      httpStatusCode: err?.$metadata?.httpStatusCode,
      requestId: err?.$metadata?.requestId,
      // SAFE configuration logging
      config: {
        provider: "R2",
        region: "auto",
        endpointHost: process.env.R2_ENDPOINT 
          ? new URL(process.env.R2_ENDPOINT).hostname 
          : `${process.env.R2_ACCOUNT_ID?.trim()}.r2.cloudflarestorage.com`,
        endpointProtocol: "https:",
        envPresence: {
          accountId: !!process.env.R2_ACCOUNT_ID,
          accessKey: !!process.env.R2_ACCESS_KEY_ID,
          secretKey: !!process.env.R2_SECRET_ACCESS_KEY,
          bucket: !!process.env.R2_BUCKET_NAME,
        }
      }
    });

    return NextResponse.json(
      { error: "Không thể kết nối tới kho lưu trữ tài liệu.", code: "R2_CONNECTION_ERROR" },
      { status: 500 },
    );
  }
}
