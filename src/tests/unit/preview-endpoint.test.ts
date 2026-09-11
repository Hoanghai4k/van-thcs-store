/**
 * Unit tests for the product preview API endpoint.
 *
 * Tests the GET handler logic by mocking the Supabase admin client.
 * Verifies security constraints: no storage_path, no DOCX/ZIP exposure.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ──────────────────────────────────────────────────────

const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockCreateSignedUrl = vi.fn();

const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    single: mockSingle,
  }),
});

const mockSelectPreview = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    maybeSingle: mockMaybeSingle,
  }),
});

// Track which table is queried to dispatch correct mock
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === "products") {
    return { select: mockSelect };
  }
  if (table === "product_previews") {
    return { select: mockSelectPreview };
  }
  return { select: vi.fn() };
});

const mockStorageFrom = vi.fn().mockReturnValue({
  createSignedUrl: mockCreateSignedUrl,
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
    storage: { from: mockStorageFrom },
  }),
}));

vi.mock("@/lib/constants", () => ({
  STORAGE_BUCKETS: {
    PRODUCT_FILES: "product-files",
    PRODUCT_ASSETS: "product-assets",
    PRODUCT_PREVIEWS: "product-previews",
  },
}));

// ── Import handler after mocks ──────────────────────────────────────

import { GET } from "@/app/api/products/[productId]/preview/route";
import { NextRequest } from "next/server";

function makeRequest(productId: string) {
  const url = `http://localhost:3000/api/products/${productId}/preview`;
  const request = new NextRequest(url);
  const params = Promise.resolve({ productId });
  return { request, params };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("GET /api/products/[productId]/preview", () => {
  const VALID_UUID = "11111111-2222-3333-4444-555555555555";
  const SIGNED_URL = "https://storage.example.com/signed-preview.pdf?token=abc";

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset chained mocks each time
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    });

    mockSelectPreview.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
    });
  });

  it("returns 404 for invalid UUID format", async () => {
    const { request, params } = makeRequest("not-a-uuid");
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns 404 for unknown product", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

    const { request, params } = makeRequest(VALID_UUID);
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns 404 for inactive product", async () => {
    mockSingle.mockResolvedValue({
      data: { id: VALID_UUID, product_type: "PAID", is_active: false },
      error: null,
    });

    const { request, params } = makeRequest(VALID_UUID);
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
  });

  it("returns 404 for BONUS product", async () => {
    mockSingle.mockResolvedValue({
      data: { id: VALID_UUID, product_type: "BONUS", is_active: true },
      error: null,
    });

    const { request, params } = makeRequest(VALID_UUID);
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("không hỗ trợ");
  });

  it("returns 404 when no preview exists", async () => {
    mockSingle.mockResolvedValue({
      data: { id: VALID_UUID, product_type: "PAID", is_active: true },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { request, params } = makeRequest(VALID_UUID);
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("chưa sẵn sàng");
  });

  it("redirects to signed URL for PAID product with preview", async () => {
    mockSingle.mockResolvedValue({
      data: { id: VALID_UUID, product_type: "PAID", is_active: true },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { storage_path: "previews/test.pdf" },
      error: null,
    });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: SIGNED_URL },
      error: null,
    });

    const { request, params } = makeRequest(VALID_UUID);
    const response = await GET(request, { params });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(SIGNED_URL);
  });

  it("returns 500 when signed URL creation fails", async () => {
    mockSingle.mockResolvedValue({
      data: { id: VALID_UUID, product_type: "PAID", is_active: true },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { storage_path: "previews/test.pdf" },
      error: null,
    });
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "storage error" },
    });

    const { request, params } = makeRequest(VALID_UUID);
    const response = await GET(request, { params });

    expect(response.status).toBe(500);
  });

  it("never exposes storage_path in response body", async () => {
    // Product found but no preview
    mockSingle.mockResolvedValue({
      data: { id: VALID_UUID, product_type: "PAID", is_active: true },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { request, params } = makeRequest(VALID_UUID);
    const response = await GET(request, { params });
    const text = await response.text();

    expect(text).not.toContain("storage_path");
    expect(text).not.toContain(".docx");
    expect(text).not.toContain(".zip");
  });

  it("uses product-previews bucket, never product-files", async () => {
    mockSingle.mockResolvedValue({
      data: { id: VALID_UUID, product_type: "PAID", is_active: true },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { storage_path: "previews/test.pdf" },
      error: null,
    });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: SIGNED_URL },
      error: null,
    });

    const { request, params } = makeRequest(VALID_UUID);
    await GET(request, { params });

    expect(mockStorageFrom).toHaveBeenCalledWith("product-previews");
    expect(mockStorageFrom).not.toHaveBeenCalledWith("product-files");
  });
});
