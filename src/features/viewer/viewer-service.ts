/**
 * Secure Full Document Viewer Service.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * - This service uses service-role backend access (getSupabaseAdmin) to inspect
 *   internal tables: public.product_files and public.document_view_artifacts.
 * - MUST ONLY be invoked AFTER customer entitlement has been positively verified
 *   using authenticated SSR client enforcing database Row Level Security.
 * - Under NO circumstances may storage_prefix, source_sha256, master storage_path,
 *   or service-role credentials be exposed in the returned metadata.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { RENDERER_VERSION } from "./constants";
import type { SafeViewerFile, SafeViewerMetadata } from "./types";

interface DocumentManifestItem {
  key: string;
  name: string;
  pageCount: number;
}

function parseManifest(raw: unknown): DocumentManifestItem[] {
  if (!Array.isArray(raw)) return [];
  const entries: DocumentManifestItem[] = [];

  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof item.key === "string" &&
      /^doc-\d{4}$/.test(item.key) &&
      typeof item.pageCount === "number" &&
      Number.isInteger(item.pageCount) &&
      item.pageCount >= 1
    ) {
      entries.push({
        key: item.key,
        name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : item.key,
        pageCount: item.pageCount,
      });
    }
  }

  return entries;
}

/**
 * Load safe document metadata for an entitled product's files.
 * ONLY call after customer entitlement has been positively verified.
 */
export async function getViewerMetadataForProduct(
  productId: string,
): Promise<SafeViewerMetadata> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch product basic info
  const { data: product } = await supabase
    .from("products")
    .select("id, name, slug")
    .eq("id", productId)
    .single();

  const productName = product?.name || "Tài liệu";
  const productSlug = product?.slug || null;

  // 2. Fetch all product_files for this product
  const { data: files } = await supabase
    .from("product_files")
    .select("id, file_name, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });

  if (!files || files.length === 0) {
    return {
      productId,
      productName,
      productSlug,
      files: [],
      hasAnyViewable: false,
    };
  }

  const fileIds = files.map((f) => f.id);

  // 3. Fetch READY and active artifacts for these files
  const { data: artifacts } = await supabase
    .from("document_view_artifacts")
    .select("id, product_file_id, status, page_count, document_manifest, renderer_version, updated_at")
    .in("product_file_id", fileIds)
    .eq("renderer_version", RENDERER_VERSION)
    .order("updated_at", { ascending: false });

  // Map latest artifact per file
  const artifactMap = new Map<string, NonNullable<typeof artifacts>[number]>();
  if (artifacts) {
    for (const art of artifacts) {
      if (!artifactMap.has(art.product_file_id)) {
        artifactMap.set(art.product_file_id, art);
      }
    }
  }

  const safeFiles: SafeViewerFile[] = [];
  let hasAnyViewable = false;

  for (const file of files) {
    const isZip = file.file_name.toLowerCase().endsWith(".zip");
    if (isZip) {
      safeFiles.push({
        fileId: file.id,
        fileName: file.file_name,
        isViewable: false,
        statusMessage: "Định dạng này chưa hỗ trợ xem trực tuyến.",
        documents: [],
      });
      continue;
    }

    const artifact = artifactMap.get(file.id);

    if (!artifact) {
      safeFiles.push({
        fileId: file.id,
        fileName: file.file_name,
        isViewable: false,
        statusMessage: "Tài liệu đang được chuẩn bị để xem.",
        documents: [],
      });
      continue;
    }

    if (artifact.status === "READY") {
      const manifestDocs = parseManifest(artifact.document_manifest);
      if (manifestDocs.length > 0) {
        hasAnyViewable = true;
        safeFiles.push({
          fileId: file.id,
          fileName: file.file_name,
          isViewable: true,
          pageCount: artifact.page_count ?? manifestDocs.reduce((acc, d) => acc + d.pageCount, 0),
          documents: manifestDocs.map((d) => ({
            documentKey: d.key,
            name: d.name,
            pageCount: d.pageCount,
          })),
        });
        continue;
      }
    }

    if (artifact.status === "PROCESSING" || artifact.status === "PENDING") {
      safeFiles.push({
        fileId: file.id,
        fileName: file.file_name,
        isViewable: false,
        statusMessage: "Tài liệu đang được chuẩn bị để xem.",
        documents: [],
      });
      continue;
    }

    if (artifact.status.startsWith("FAILED")) {
      safeFiles.push({
        fileId: file.id,
        fileName: file.file_name,
        isViewable: false,
        statusMessage: "Hiện chưa thể mở tài liệu. Vui lòng thử lại sau.",
        documents: [],
      });
      continue;
    }

    safeFiles.push({
      fileId: file.id,
      fileName: file.file_name,
      isViewable: false,
      statusMessage: "Tài liệu đang được chuẩn bị để xem.",
      documents: [],
    });
  }

  return {
    productId,
    productName,
    productSlug,
    files: safeFiles,
    hasAnyViewable,
  };
}

/**
 * Bulk check which products have at least one READY full-view artifact.
 * Used by My Library to display the active "Xem tài liệu" button.
 */
export async function checkProductsArtifactReadiness(
  productIds: string[],
): Promise<Set<string>> {
  if (!productIds || productIds.length === 0) {
    return new Set();
  }

  const supabase = getSupabaseAdmin();

  // 1. Get product_files for these products
  const { data: files } = await supabase
    .from("product_files")
    .select("id, product_id, file_name")
    .in("product_id", productIds);

  if (!files || files.length === 0) {
    return new Set();
  }

  // Filter out ZIP files
  const nonZipFiles = files.filter((f) => !f.file_name.toLowerCase().endsWith(".zip"));
  if (nonZipFiles.length === 0) {
    return new Set();
  }

  const fileToProductMap = new Map<string, string>();
  for (const f of nonZipFiles) {
    fileToProductMap.set(f.id, f.product_id);
  }

  // 2. Query READY artifacts for these files
  const { data: readyArtifacts } = await supabase
    .from("document_view_artifacts")
    .select("product_file_id")
    .in("product_file_id", Array.from(fileToProductMap.keys()))
    .eq("renderer_version", RENDERER_VERSION)
    .eq("status", "READY");

  const readyProductIds = new Set<string>();
  if (readyArtifacts) {
    for (const art of readyArtifacts) {
      const prodId = fileToProductMap.get(art.product_file_id);
      if (prodId) {
        readyProductIds.add(prodId);
      }
    }
  }

  return readyProductIds;
}
