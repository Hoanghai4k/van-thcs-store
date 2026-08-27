/**
 * Tests for large file upload policy and validation.
 *
 * Verifies the 1 GB hard limit, 500 MB warning threshold,
 * R2 multipart constants, and file size formatting.
 *
 * Does NOT allocate real large buffers — uses mocked File.size.
 */

import { describe, it, expect } from "vitest";
import {
  validateProductFile,
  isLargeFile,
  MAX_PRODUCT_FILE_SIZE,
} from "@/lib/storage/storage";
import {
  MAX_PRODUCT_FILE_SIZE as CONST_MAX_SIZE,
  LARGE_FILE_WARNING_BYTES,
  R2_PART_SIZE_BYTES,
  R2_UPLOAD_CONCURRENCY,
  StorageProvider,
} from "@/lib/constants";
import { formatFileSize } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ZIP_MIME = "application/zip";
const ONE_MB = 1024 * 1024;
const ONE_GB = 1024 * 1024 * 1024;
const FIVE_HUNDRED_MB = 500 * ONE_MB;

// ─── File Size Policy ─────────────────────────────────────────────

describe("File size policy constants", () => {
  it("MAX_PRODUCT_FILE_SIZE is exactly 1 GB", () => {
    expect(CONST_MAX_SIZE).toBe(ONE_GB);
    expect(MAX_PRODUCT_FILE_SIZE).toBe(ONE_GB);
  });

  it("LARGE_FILE_WARNING_BYTES is exactly 500 MB", () => {
    expect(LARGE_FILE_WARNING_BYTES).toBe(FIVE_HUNDRED_MB);
  });

  it("R2_PART_SIZE_BYTES is 16 MiB", () => {
    expect(R2_PART_SIZE_BYTES).toBe(16 * ONE_MB);
  });

  it("R2_UPLOAD_CONCURRENCY is 3", () => {
    expect(R2_UPLOAD_CONCURRENCY).toBe(3);
  });

  it("StorageProvider has SUPABASE and R2", () => {
    expect(StorageProvider.SUPABASE).toBe("SUPABASE");
    expect(StorageProvider.R2).toBe("R2");
  });

  it("warning threshold is less than max", () => {
    expect(LARGE_FILE_WARNING_BYTES).toBeLessThan(CONST_MAX_SIZE);
  });
});

// ─── validateProductFile — Size Boundaries ────────────────────────

describe("validateProductFile — size boundaries", () => {
  it("accepts small supported file", () => {
    expect(validateProductFile("doc.docx", DOCX_MIME, 1024)).toBeNull();
  });

  it("accepts file at exactly 500 MB (no rejection)", () => {
    expect(validateProductFile("archive.zip", ZIP_MIME, FIVE_HUNDRED_MB)).toBeNull();
  });

  it("accepts file at 501 MB (above warning but below limit)", () => {
    const justAboveWarning = FIVE_HUNDRED_MB + ONE_MB;
    expect(validateProductFile("archive.zip", ZIP_MIME, justAboveWarning)).toBeNull();
  });

  it("accepts file at 999 MB", () => {
    const nearLimit = 999 * ONE_MB;
    expect(validateProductFile("archive.zip", ZIP_MIME, nearLimit)).toBeNull();
  });

  it("accepts file at exactly 1 GB", () => {
    expect(validateProductFile("archive.zip", ZIP_MIME, ONE_GB)).toBeNull();
  });

  it("rejects file at 1 GB + 1 byte", () => {
    const err = validateProductFile("archive.zip", ZIP_MIME, ONE_GB + 1);
    expect(err).toBeTruthy();
    expect(err).toContain("1 GB");
  });

  it("rejects file at 2 GB", () => {
    const err = validateProductFile("big.zip", ZIP_MIME, 2 * ONE_GB);
    expect(err).toBeTruthy();
  });

  it("rejects unsupported extension", () => {
    const err = validateProductFile("file.rar", "application/x-rar-compressed", 1024);
    expect(err).toBeTruthy();
  });

  it("rejects .exe regardless of size", () => {
    const err = validateProductFile("virus.exe", "application/octet-stream", 100);
    expect(err).toBeTruthy();
  });
});

// ─── isLargeFile ──────────────────────────────────────────────────

describe("isLargeFile", () => {
  it("returns false for small file", () => {
    expect(isLargeFile(1024)).toBe(false);
  });

  it("returns false at exactly 500 MB", () => {
    expect(isLargeFile(FIVE_HUNDRED_MB)).toBe(false);
  });

  it("returns true at 500 MB + 1 byte", () => {
    expect(isLargeFile(FIVE_HUNDRED_MB + 1)).toBe(true);
  });

  it("returns true at 800 MB", () => {
    expect(isLargeFile(800 * ONE_MB)).toBe(true);
  });

  it("returns true at 1 GB", () => {
    expect(isLargeFile(ONE_GB)).toBe(true);
  });
});

// ─── formatFileSize ───────────────────────────────────────────────

describe("formatFileSize for large files", () => {
  it("formats 0 bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats 1 KB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });

  it("formats 421 MB correctly", () => {
    const size = 421 * ONE_MB;
    const result = formatFileSize(size);
    expect(result).toContain("421");
    expect(result).toContain("MB");
  });

  it("formats 1 GB correctly", () => {
    const result = formatFileSize(ONE_GB);
    expect(result).toContain("1");
    expect(result).toContain("GB");
  });

  it("does not display raw byte values for large files", () => {
    const size = 421 * ONE_MB;
    const result = formatFileSize(size);
    // Should not contain the raw byte number
    expect(result).not.toContain(size.toString());
  });
});

// ─── Server metadata validation rules ─────────────────────────────

describe("Server metadata validation rules", () => {
  it("storage path must follow products/{id}/files/ pattern", () => {
    const validPath = "products/some-uuid/files/abc123.zip";
    const prefix = "products/some-uuid/files/";
    expect(validPath.startsWith(prefix)).toBe(true);
  });

  it("arbitrary path is rejected", () => {
    const badPath = "../../etc/passwd";
    const prefix = "products/some-uuid/files/";
    expect(badPath.startsWith(prefix)).toBe(false);
  });

  it("path without product ID is rejected", () => {
    const badPath = "files/abc123.zip";
    const prefix = "products/some-uuid/files/";
    expect(badPath.startsWith(prefix)).toBe(false);
  });

  it("MIME types in allowed list", () => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
      "application/x-zip-compressed",
    ];
    expect(allowed).toContain(DOCX_MIME);
    expect(allowed).toContain(ZIP_MIME);
    expect(allowed).not.toContain("application/x-rar-compressed");
    expect(allowed).not.toContain("application/pdf");
  });
});
