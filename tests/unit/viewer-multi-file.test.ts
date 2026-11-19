import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkProductsArtifactReadiness, getViewerMetadataForProduct } from "@/features/viewer/viewer-service";
import * as adminSupa from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("Multi-File Product Viewer Readiness & Metadata (Regression Suite)", () => {
  const targetProductId = "a358bcd6-5da9-4dab-9ecf-f44eac8d9275";
  const file1DocxId = "b1fdd288-b378-4c28-bb57-836c57dcd439";
  const file2ZipId = "8f580aad-c8d4-4e94-9e09-da64b357e7ba";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Multi-file product is viewerReady when at least ONE file is READY
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 1: checkProductsArtifactReadiness marks product ready when File A is READY and File B is ZIP", async () => {
    vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "product_files") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: file1DocxId, product_id: targetProductId, file_name: "8 chuyen de K1.docx" },
                { id: file2ZipId, product_id: targetProductId, file_name: "daythem6.zip" },
              ],
              error: null,
            }),
          };
        }
        if (table === "document_view_artifacts") {
          const artifactQuery = {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn((col: string, val: string) => {
              if (col === "status" && val === "READY") {
                return Promise.resolve({
                  data: [{ product_file_id: file1DocxId }],
                  error: null,
                });
              }
              return artifactQuery;
            }),
          };
          return artifactQuery;
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as SupabaseClient<Database>);

    const readySet = await checkProductsArtifactReadiness([targetProductId]);
    expect(readySet.has(targetProductId)).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Multi-file product is NOT ready when NO file has a READY artifact
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 2: checkProductsArtifactReadiness marks product NOT ready when neither file is prepared", async () => {
    vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "product_files") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: file1DocxId, product_id: targetProductId, file_name: "8 chuyen de K1.docx" },
                { id: file2ZipId, product_id: targetProductId, file_name: "daythem6.zip" },
              ],
              error: null,
            }),
          };
        }
        if (table === "document_view_artifacts") {
          const artifactQuery = {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn((col: string, val: string) => {
              if (col === "status" && val === "READY") {
                return Promise.resolve({
                  data: [],
                  error: null,
                });
              }
              return artifactQuery;
            }),
          };
          return artifactQuery;
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as SupabaseClient<Database>);

    const readySet = await checkProductsArtifactReadiness([targetProductId]);
    expect(readySet.has(targetProductId)).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Multi-file product with two DOCX files where only File A is READY
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 3: checkProductsArtifactReadiness marks product ready when File A is READY and File B is still PENDING", async () => {
    const fileBId = "33333333-3333-3333-3333-333333333333";

    vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "product_files") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: file1DocxId, product_id: targetProductId, file_name: "Doc A.docx" },
                { id: fileBId, product_id: targetProductId, file_name: "Doc B.docx" },
              ],
              error: null,
            }),
          };
        }
        if (table === "document_view_artifacts") {
          const artifactQuery = {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn((col: string, val: string) => {
              if (col === "status" && val === "READY") {
                // Only file 1 is READY; file B is not returned
                return Promise.resolve({
                  data: [{ product_file_id: file1DocxId }],
                  error: null,
                });
              }
              return artifactQuery;
            }),
          };
          return artifactQuery;
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as SupabaseClient<Database>);

    const readySet = await checkProductsArtifactReadiness([targetProductId]);
    expect(readySet.has(targetProductId)).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: getViewerMetadataForProduct provides viewable File A and unready File B
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 4: getViewerMetadataForProduct returns hasAnyViewable=true with File A viewable and File B status message", async () => {
    vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "products") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: targetProductId, name: "8 chuyên đề dạy thêm lớp 6", slug: "8-chuyen-de-day-them-lop-6" },
              error: null,
            }),
          };
        }
        if (table === "product_files") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                { id: file1DocxId, file_name: "8 chuyên đề dạy thêm K1  Văn 6 rất hay.docx", created_at: "2026-08-27T04:46:02Z" },
                { id: file2ZipId, file_name: "daythem6.zip", created_at: "2026-08-27T04:47:08Z" },
              ],
              error: null,
            }),
          };
        }
        if (table === "document_view_artifacts") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "art-1",
                  product_file_id: file1DocxId,
                  status: "READY",
                  page_count: 40,
                  document_manifest: [
                    { key: "doc-0001", name: "8 chuyên đề dạy thêm K1  Văn 6 rất hay.docx", pageCount: 40 },
                  ],
                  renderer_version: "webp-prod-v1",
                  updated_at: "2026-11-19T15:27:00Z",
                },
              ],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as SupabaseClient<Database>);

    const meta = await getViewerMetadataForProduct(targetProductId);

    expect(meta.productId).toBe(targetProductId);
    expect(meta.hasAnyViewable).toBe(true);
    expect(meta.files).toHaveLength(2);

    // File 1 (DOCX) is viewable
    const file1 = meta.files.find((f) => f.fileId === file1DocxId);
    expect(file1).toBeDefined();
    expect(file1?.isViewable).toBe(true);
    expect(file1?.pageCount).toBe(40);
    expect(file1?.documents).toHaveLength(1);
    expect(file1?.documents[0].documentKey).toBe("doc-0001");

    // File 2 (ZIP) is not viewable with clean status message
    const file2 = meta.files.find((f) => f.fileId === file2ZipId);
    expect(file2).toBeDefined();
    expect(file2?.isViewable).toBe(false);
    expect(file2?.statusMessage).toBe("Định dạng này chưa hỗ trợ xem trực tuyến.");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: getViewerMetadataForProduct handles non-ZIP unready file
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 5: getViewerMetadataForProduct marks unready DOCX with 'Tài liệu đang được chuẩn bị để xem.'", async () => {
    const fileBId = "44444444-4444-4444-4444-444444444444";

    vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "products") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: targetProductId, name: "8 chuyên đề", slug: "8-chuyen-de" },
              error: null,
            }),
          };
        }
        if (table === "product_files") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                { id: file1DocxId, file_name: "Chuyen_de_1.docx", created_at: "2026-08-27T04:46:02Z" },
                { id: fileBId, file_name: "Chuyen_de_2.docx", created_at: "2026-08-27T04:47:00Z" },
              ],
              error: null,
            }),
          };
        }
        if (table === "document_view_artifacts") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                // Only file 1 is READY; file B has no artifact
                {
                  id: "art-1",
                  product_file_id: file1DocxId,
                  status: "READY",
                  page_count: 20,
                  document_manifest: [{ key: "doc-0001", name: "Chuyen_de_1.docx", pageCount: 20 }],
                  renderer_version: "webp-prod-v1",
                  updated_at: "2026-11-19T15:27:00Z",
                },
              ],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as SupabaseClient<Database>);

    const meta = await getViewerMetadataForProduct(targetProductId);
    expect(meta.hasAnyViewable).toBe(true);

    const fileB = meta.files.find((f) => f.fileId === fileBId);
    expect(fileB?.isViewable).toBe(false);
    expect(fileB?.statusMessage).toBe("Tài liệu đang được chuẩn bị để xem.");
  });
});
