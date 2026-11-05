import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/account/library/[productId]/files/[fileId]/documents/[documentKey]/pages/[page]/route";
import * as serverSupa from "@/lib/supabase/server";
import * as adminSupa from "@/lib/supabase/admin";
import * as entitlementMod from "@/features/account/library-queries";
import * as signerMod from "@/features/viewer/page-signer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/features/account/library-queries", () => ({
  verifyProductEntitlement: vi.fn(),
}));

vi.mock("@/features/viewer/page-signer", () => ({
  generatePagePresignedUrl: vi.fn(),
}));

describe("Secure Document Page API (Route Handler)", () => {
  const validProductId = "11111111-1111-1111-1111-111111111111";
  const validFileId = "22222222-2222-2222-2222-222222222222";
  const validDocKey = "doc-0001";
  const validSha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const defaultManifest = [
    { key: "doc-0001", name: "Tài liệu 1", pageCount: 10 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Authenticated user & customer
    vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-test-1", email: "user@example.com" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "cust-test-1", auth_user_id: "user-test-1" },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as SupabaseClient<Database>);

    // Default: Customer is entitled
    vi.mocked(entitlementMod.verifyProductEntitlement).mockResolvedValue({
      entitled: true,
      customer: { id: "cust-test-1", authUserId: "user-test-1", email: "user@example.com", name: "User" },
      product: { id: validProductId, name: "Sản phẩm", slug: "san-pham", isActive: true },
      acquisitionType: "PAID",
      orderCode: "VTS-001",
      acquiredAt: "2026-10-01T00:00:00Z",
    });

    // Default: Presigned URL generator
    vi.mocked(signerMod.generatePagePresignedUrl).mockResolvedValue(
      "https://r2.tailieuhangcao.vn/derived/full-view/signed-page?token=mocked-token-xyz",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupAdminDb(options: {
    file?: { id: string; product_id: string; file_name: string } | null;
    artifact?: {
      id: string;
      status: string;
      source_sha256: string;
      renderer_version: string;
      document_manifest: unknown;
    } | null;
  }) {
    const fileData = options.file === undefined
      ? { id: validFileId, product_id: validProductId, file_name: "Giao_an_ngu_van_7.pdf" }
      : options.file;

    const artifactData = options.artifact === undefined
      ? {
          id: "artifact-1",
          status: "READY",
          source_sha256: validSha256,
          renderer_version: "webp-prod-v1",
          document_manifest: defaultManifest,
        }
      : options.artifact;

    vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "product_files") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: fileData, error: null }),
          };
        }
        if (table === "document_view_artifacts") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: artifactData, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as SupabaseClient<Database>);
  }

  function createRequest(): NextRequest {
    return new NextRequest("http://localhost:3000/api/account/library/test");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9 & 18: Valid entitled page returns signed-page response
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 9 & 18: valid entitled request for READY artifact returns short-lived signed-page response", async () => {
    setupAdminDb({});

    const res = await GET(createRequest(), {
      params: Promise.resolve({
        productId: validProductId,
        fileId: validFileId,
        documentKey: validDocKey,
        page: "1",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("https://r2.tailieuhangcao.vn");
    expect(body.expiresIn).toBe(60);

    // Verify Cache-Control header
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10: Page 0 rejected
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 10: page 0 is rejected with 400 Bad Request", async () => {
    setupAdminDb({});

    const res = await GET(createRequest(), {
      params: Promise.resolve({
        productId: validProductId,
        fileId: validFileId,
        documentKey: validDocKey,
        page: "0",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_PAGE");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 11: Negative page rejected
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 11: negative page is rejected with 400 Bad Request", async () => {
    setupAdminDb({});

    const res = await GET(createRequest(), {
      params: Promise.resolve({
        productId: validProductId,
        fileId: validFileId,
        documentKey: validDocKey,
        page: "-5",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_PAGE");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 12: Page > manifest pageCount rejected
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 12: page exceeding manifest pageCount is rejected with 404 PAGE_OUT_OF_BOUNDS", async () => {
    setupAdminDb({}); // Manifest pageCount is 10

    const res = await GET(createRequest(), {
      params: Promise.resolve({
        productId: validProductId,
        fileId: validFileId,
        documentKey: validDocKey,
        page: "11",
      }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("PAGE_OUT_OF_BOUNDS");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 13: Invalid documentKey rejected (traversal & bad format)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 13: invalid documentKey (directory traversal / bad formatting) is rejected with 400", async () => {
    setupAdminDb({});

    const traversalRes = await GET(createRequest(), {
      params: Promise.resolve({
        productId: validProductId,
        fileId: validFileId,
        documentKey: "../etc/passwd",
        page: "1",
      }),
    });
    expect(traversalRes.status).toBe(400);

    const badFormatRes = await GET(createRequest(), {
      params: Promise.resolve({
        productId: validProductId,
        fileId: validFileId,
        documentKey: "malicious-doc",
        page: "1",
      }),
    });
    expect(badFormatRes.status).toBe(400);
    const body = await badFormatRes.json();
    expect(body.error).toBe("INVALID_DOCUMENT_KEY");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 14: File not belonging to product rejected
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 14: file that does not belong to the requested product is rejected with 404", async () => {
    // File belongs to a different product_id
    setupAdminDb({
      file: {
        id: validFileId,
        product_id: "99999999-9999-9999-9999-999999999999",
        file_name: "Other.pdf",
      },
    });

    const res = await GET(createRequest(), {
      params: Promise.resolve({
        productId: validProductId,
        fileId: validFileId,
        documentKey: validDocKey,
        page: "1",
      }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("FILE_NOT_FOUND");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 15: Artifact PENDING denied / not-ready
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 15: artifact with status PENDING returns 409 NOT_READY", async () => {
    setupAdminDb({
      artifact: {
        id: "art-pending",
        status: "PENDING",
        source_sha256: validSha256,
        renderer_version: "webp-prod-v1",
        document_manifest: [],
      },
    });

    const res = await GET(createRequest(), {
      params: Promise.resolve({
        productId: validProductId,
        fileId: validFileId,
        documentKey: validDocKey,
        page: "1",
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("NOT_READY");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 16: Artifact PROCESSING denied / not-ready
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 16: artifact with status PROCESSING returns 409 NOT_READY", async () => {
    setupAdminDb({
      artifact: {
        id: "art-processing",
        status: "PROCESSING",
        source_sha256: validSha256,
        renderer_version: "webp-prod-v1",
        document_manifest: [],
      },
    });

    const res = await GET(createRequest(), {
      params: Promise.resolve({
        productId: validProductId,
        fileId: validFileId,
        documentKey: validDocKey,
        page: "1",
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("NOT_READY");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 17: Artifact FAILED denied
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 17: artifact with status FAILED_FINAL returns 422 ARTIFACT_FAILED", async () => {
    setupAdminDb({
      artifact: {
        id: "art-failed",
        status: "FAILED_FINAL",
        source_sha256: validSha256,
        renderer_version: "webp-prod-v1",
        document_manifest: [],
      },
    });

    const res = await GET(createRequest(), {
      params: Promise.resolve({
        productId: validProductId,
        fileId: validFileId,
        documentKey: validDocKey,
        page: "1",
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("ARTIFACT_FAILED");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 19, 20, 21: Zero sensitive data leakage
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 19, 20, 21: response payload NEVER exposes storage_prefix, source_sha256, or master storage path", async () => {
    setupAdminDb({});

    const res = await GET(createRequest(), {
      params: Promise.resolve({
        productId: validProductId,
        fileId: validFileId,
        documentKey: validDocKey,
        page: "1",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    // 19. No storage_prefix
    expect(body.storage_prefix).toBeUndefined();
    expect(body.storagePrefix).toBeUndefined();

    // 20. No source_sha256
    expect(body.source_sha256).toBeUndefined();
    expect(body.sourceSha256).toBeUndefined();

    // 21. No master source path or internal keys
    expect(body.storage_path).toBeUndefined();
    expect(body.storagePath).toBeUndefined();
    expect(body.serviceRole).toBeUndefined();

    // Contains only minimal fields needed by browser
    expect(Object.keys(body).sort()).toEqual(["expiresIn", "url"].sort());
  });
});
