/**
 * Secure Page URL API Endpoint.
 *
 * GET /api/account/library/[productId]/files/[fileId]/documents/[documentKey]/pages/[page]
 *
 * Implements strict per-page entitlement verification and short-lived R2 presigned GET URL issuance.
 *
 * INVARIANTS:
 * 1. Authenticate Supabase user
 * 2. Resolve linked customer profile
 * 3. Verify product entitlement (PAID or BONUS attached to PAID)
 * 4. Verify file belongs to product
 * 5. Verify READY artifact exists
 * 6. Validate documentKey exists in manifest
 * 7. Validate page >= 1
 * 8. Validate page <= document pageCount
 * 9. Derive deterministic R2 object key
 * 10. Issue short-lived R2 presigned GET URL (60s TTL)
 *
 * NEVER exposes storage_prefix, source_sha256, master storage path, or service role credentials.
 * Cache-Control: private, no-store
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyProductEntitlement } from "@/features/account/library-queries";
import { generatePagePresignedUrl } from "@/features/viewer/page-signer";
import { RENDERER_VERSION, PRESIGNED_URL_EXPIRES_IN_SECONDS } from "@/features/viewer/constants";

interface RouteParams {
  params: Promise<{
    productId: string;
    fileId: string;
    documentKey: string;
    page: string;
  }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOC_KEY_REGEX = /^doc-\d{4}$/;

interface DocumentManifestItem {
  key: string;
  name: string;
  pageCount: number;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const { productId, fileId, documentKey, page } = await params;

  // 0. Format & parameter sanitization
  if (!productId || !UUID_REGEX.test(productId)) {
    return NextResponse.json(
      { error: "INVALID_PRODUCT_ID", message: "Mã sản phẩm không hợp lệ." },
      { status: 400 },
    );
  }

  if (!fileId || !UUID_REGEX.test(fileId)) {
    return NextResponse.json(
      { error: "INVALID_FILE_ID", message: "Mã tệp không hợp lệ." },
      { status: 400 },
    );
  }

  // Traversal and injection guard for documentKey
  if (
    !documentKey ||
    documentKey.includes("..") ||
    documentKey.includes("/") ||
    documentKey.includes("\\") ||
    !DOC_KEY_REGEX.test(documentKey)
  ) {
    return NextResponse.json(
      { error: "INVALID_DOCUMENT_KEY", message: "Mã phần tài liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const pageNum = parseInt(page, 10);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > 9999 || String(pageNum) !== page) {
    return NextResponse.json(
      { error: "INVALID_PAGE", message: "Số trang không hợp lệ." },
      { status: 400 },
    );
  }

  // 1. Authenticate user from SSR session
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Vui lòng đăng nhập để tiếp tục." },
      { status: 401 },
    );
  }

  // 2. Resolve linked customer business identity
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (customerError || !customer || !customer.auth_user_id) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Tài khoản khách hàng chưa được liên kết." },
      { status: 403 },
    );
  }

  // 3. Verify product entitlement via centralized helper
  const entitlement = await verifyProductEntitlement(productId, supabase);
  if (!entitlement.entitled) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: entitlement.message || "Bạn chưa có quyền xem tài liệu này." },
      { status: 403 },
    );
  }

  // 4. Verify file belongs to product (Service Role access)
  const supabaseAdmin = getSupabaseAdmin();
  const { data: file, error: fileError } = await supabaseAdmin
    .from("product_files")
    .select("id, product_id, file_name")
    .eq("id", fileId)
    .maybeSingle();

  if (fileError || !file || file.product_id !== productId) {
    return NextResponse.json(
      { error: "FILE_NOT_FOUND", message: "Tệp không tồn tại trong tài liệu này." },
      { status: 404 },
    );
  }

  if (file.file_name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json(
      { error: "UNSUPPORTED_FORMAT", message: "Định dạng này chưa hỗ trợ xem trực tuyến." },
      { status: 400 },
    );
  }

  // 5. Find READY artifact for configured renderer_version
  const { data: artifact, error: artifactError } = await supabaseAdmin
    .from("document_view_artifacts")
    .select("id, status, source_sha256, renderer_version, document_manifest")
    .eq("product_file_id", fileId)
    .eq("renderer_version", RENDERER_VERSION)
    .order("updated_at", { ascending: false })
    .maybeSingle();

  if (artifactError || !artifact) {
    return NextResponse.json(
      { error: "NOT_READY", message: "Tài liệu đang được chuẩn bị để xem." },
      { status: 404 },
    );
  }

  if (artifact.status === "PENDING" || artifact.status === "PROCESSING") {
    return NextResponse.json(
      { error: "NOT_READY", message: "Tài liệu đang được chuẩn bị để xem." },
      { status: 409 },
    );
  }

  if (artifact.status.startsWith("FAILED")) {
    return NextResponse.json(
      { error: "ARTIFACT_FAILED", message: "Hiện chưa thể mở tài liệu. Vui lòng thử lại sau." },
      { status: 422 },
    );
  }

  if (artifact.status !== "READY") {
    return NextResponse.json(
      { error: "NOT_READY", message: "Tài liệu chưa sẵn sàng để xem." },
      { status: 409 },
    );
  }

  // 6. Validate documentKey exists in manifest
  const manifest = (Array.isArray(artifact.document_manifest)
    ? artifact.document_manifest
    : []) as unknown as DocumentManifestItem[];

  const docEntry = manifest.find((d) => d && d.key === documentKey);
  if (!docEntry) {
    return NextResponse.json(
      { error: "DOCUMENT_NOT_FOUND", message: "Không tìm thấy phần tài liệu này." },
      { status: 404 },
    );
  }

  // 7 & 8. Validate page bounds (1 <= page <= docEntry.pageCount)
  if (pageNum > docEntry.pageCount) {
    return NextResponse.json(
      { error: "PAGE_OUT_OF_BOUNDS", message: "Trang vượt quá số trang của tài liệu." },
      { status: 404 },
    );
  }

  // 9. Derive deterministic R2 object key
  const pageFilename = `page-${pageNum.toString().padStart(4, "0")}.webp`;
  const r2Key = `derived/full-view/${fileId}/${artifact.source_sha256}/${artifact.renderer_version}/${documentKey}/${pageFilename}`;

  // 10. Issue short-lived R2 presigned GET URL
  try {
    const url = await generatePagePresignedUrl(r2Key, PRESIGNED_URL_EXPIRES_IN_SECONDS);

    // 11. Return response with strictly minimal data
    return NextResponse.json(
      {
        url,
        expiresIn: PRESIGNED_URL_EXPIRES_IN_SECONDS,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "STORAGE_ERROR", message: "Không thể tạo liên kết xem trang. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

