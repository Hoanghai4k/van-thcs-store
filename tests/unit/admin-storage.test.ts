/**
 * Unit tests for storage utilities and admin infrastructure.
 *
 * These test application-level helpers — not PostgreSQL RLS
 * (which requires a real Supabase instance to test).
 */

import { describe, it, expect } from "vitest";
import {
  getProductFilePath,
  getProductAssetPath,
  getProductFilesBucket,
  getProductAssetsBucket,
  isAllowedDocumentType,
  isAllowedImageType,
  isDocxExtension,
} from "@/lib/storage/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";

// ─── Storage Path Generation ──────────────────────────────────────

describe("Storage path generation", () => {
  it("generates correct product file path", () => {
    const path = getProductFilePath("uuid-123", "abc.docx");
    expect(path).toBe("products/uuid-123/files/abc.docx");
  });

  it("generates correct product asset path", () => {
    const path = getProductAssetPath("uuid-456", "thumb.webp");
    expect(path).toBe("products/uuid-456/assets/thumb.webp");
  });

  it("file path includes product ID for isolation", () => {
    const path1 = getProductFilePath("aaa", "file.docx");
    const path2 = getProductFilePath("bbb", "file.docx");
    expect(path1).not.toBe(path2);
    expect(path1).toContain("aaa");
    expect(path2).toContain("bbb");
  });
});

// ─── Bucket Names ─────────────────────────────────────────────────

describe("Storage bucket names", () => {
  it("returns correct product-files bucket", () => {
    expect(getProductFilesBucket()).toBe("product-files");
  });

  it("returns correct product-assets bucket", () => {
    expect(getProductAssetsBucket()).toBe("product-assets");
  });

  it("STORAGE_BUCKETS has correct values", () => {
    expect(STORAGE_BUCKETS.PRODUCT_FILES).toBe("product-files");
    expect(STORAGE_BUCKETS.PRODUCT_ASSETS).toBe("product-assets");
  });

  it("product-files and product-assets are different buckets", () => {
    expect(STORAGE_BUCKETS.PRODUCT_FILES).not.toBe(STORAGE_BUCKETS.PRODUCT_ASSETS);
  });
});

// ─── MIME Type Validation ─────────────────────────────────────────

describe("Document MIME validation", () => {
  it("accepts valid .docx MIME type", () => {
    expect(
      isAllowedDocumentType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
  });

  it("rejects PDF", () => {
    expect(isAllowedDocumentType("application/pdf")).toBe(false);
  });

  it("rejects plain text", () => {
    expect(isAllowedDocumentType("text/plain")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isAllowedDocumentType("")).toBe(false);
  });

  it("rejects image MIME as document", () => {
    expect(isAllowedDocumentType("image/jpeg")).toBe(false);
  });
});

describe("Image MIME validation", () => {
  it("accepts JPEG", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
  });

  it("accepts PNG", () => {
    expect(isAllowedImageType("image/png")).toBe(true);
  });

  it("accepts WebP", () => {
    expect(isAllowedImageType("image/webp")).toBe(true);
  });

  it("rejects GIF", () => {
    expect(isAllowedImageType("image/gif")).toBe(false);
  });

  it("rejects SVG", () => {
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
  });

  it("rejects docx MIME as image", () => {
    expect(
      isAllowedImageType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(false);
  });
});

// ─── File Extension Validation ────────────────────────────────────

describe("Docx extension validation", () => {
  it("accepts .docx", () => {
    expect(isDocxExtension("report.docx")).toBe(true);
  });

  it("accepts .DOCX (case-insensitive)", () => {
    expect(isDocxExtension("REPORT.DOCX")).toBe(true);
  });

  it("accepts .DocX (mixed case)", () => {
    expect(isDocxExtension("file.DocX")).toBe(true);
  });

  it("rejects .doc (old format)", () => {
    expect(isDocxExtension("file.doc")).toBe(false);
  });

  it("rejects .pdf", () => {
    expect(isDocxExtension("file.pdf")).toBe(false);
  });

  it("rejects no extension", () => {
    expect(isDocxExtension("file")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isDocxExtension("")).toBe(false);
  });
});
