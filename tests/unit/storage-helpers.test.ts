/**
 * Tests for storage helpers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProductFilePath,
  getProductAssetPath,
  getProductAssetUrl,
  isAllowedDocumentType,
  isAllowedImageType,
  isDocxExtension,
  getProductFilesBucket,
  getProductAssetsBucket,
} from "../../src/lib/storage/storage";

describe("getProductFilePath", () => {
  it("builds correct file path", () => {
    expect(getProductFilePath("abc-123", "test.docx")).toBe(
      "products/abc-123/files/test.docx",
    );
  });
});

describe("getProductAssetPath", () => {
  it("builds correct asset path", () => {
    expect(getProductAssetPath("abc-123", "thumb.webp")).toBe(
      "products/abc-123/assets/thumb.webp",
    );
  });
});

describe("getProductAssetUrl", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  });

  it("returns null for null input", () => {
    expect(getProductAssetUrl(null)).toBeNull();
  });

  it("returns correct public URL", () => {
    expect(getProductAssetUrl("products/abc/assets/img.webp")).toBe(
      "https://test.supabase.co/storage/v1/object/public/product-assets/products/abc/assets/img.webp",
    );
  });

  it("returns null when SUPABASE_URL is not set", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(getProductAssetUrl("test/path")).toBeNull();
    // Restore
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
  });
});

describe("bucket names", () => {
  it("returns correct bucket names", () => {
    expect(getProductFilesBucket()).toBe("product-files");
    expect(getProductAssetsBucket()).toBe("product-assets");
  });
});

describe("isAllowedDocumentType", () => {
  it("accepts docx MIME type", () => {
    expect(
      isAllowedDocumentType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
  });

  it("rejects other MIME types", () => {
    expect(isAllowedDocumentType("application/pdf")).toBe(false);
    expect(isAllowedDocumentType("text/plain")).toBe(false);
    expect(isAllowedDocumentType("application/msword")).toBe(false);
  });
});

describe("isAllowedImageType", () => {
  it("accepts valid image types", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/webp")).toBe(true);
  });

  it("rejects invalid image types", () => {
    expect(isAllowedImageType("image/gif")).toBe(false);
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
    expect(isAllowedImageType("application/pdf")).toBe(false);
  });
});

describe("isDocxExtension", () => {
  it("accepts .docx extension", () => {
    expect(isDocxExtension("document.docx")).toBe(true);
    expect(isDocxExtension("my file.DOCX")).toBe(true);
  });

  it("rejects non-docx extensions", () => {
    expect(isDocxExtension("document.doc")).toBe(false);
    expect(isDocxExtension("document.pdf")).toBe(false);
    expect(isDocxExtension("document.txt")).toBe(false);
    expect(isDocxExtension("docx")).toBe(false);
  });
});
