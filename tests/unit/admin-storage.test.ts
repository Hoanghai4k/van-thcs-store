/**
 * Unit tests for storage utilities and file validation.
 *
 * Tests the generalized file validation system that supports
 * DOCX and ZIP while blocking dangerous file types.
 */

import { describe, it, expect } from "vitest";
import {
  getProductFilePath,
  getProductAssetPath,
  getProductFilesBucket,
  getProductAssetsBucket,
  isAllowedProductFileType,
  isAllowedImageType,
  isAllowedFileExtension,
  isDocxExtension,
  isDangerousExtension,
  getFileExtension,
  getFormatLabel,
  getSafeExtension,
  validateProductFile,
  MAX_PRODUCT_FILE_SIZE,
} from "@/lib/storage/storage";
import { STORAGE_BUCKETS, ALLOWED_PRODUCT_FILE_MIMES, ALLOWED_FILE_EXTENSIONS, DANGEROUS_EXTENSIONS, MAX_PRODUCT_FILE_SIZE as CONST_MAX_SIZE } from "@/lib/constants";

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

  it("supports ZIP file extension in path", () => {
    const path = getProductFilePath("prod-1", "uuid123.zip");
    expect(path).toBe("products/prod-1/files/uuid123.zip");
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

describe("Product file MIME validation", () => {
  it("accepts valid .docx MIME type", () => {
    expect(
      isAllowedProductFileType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
  });

  it("accepts application/zip", () => {
    expect(isAllowedProductFileType("application/zip")).toBe(true);
  });

  it("accepts application/x-zip-compressed", () => {
    expect(isAllowedProductFileType("application/x-zip-compressed")).toBe(true);
  });

  it("rejects PDF", () => {
    expect(isAllowedProductFileType("application/pdf")).toBe(false);
  });

  it("rejects plain text", () => {
    expect(isAllowedProductFileType("text/plain")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isAllowedProductFileType("")).toBe(false);
  });

  it("rejects image MIME as document", () => {
    expect(isAllowedProductFileType("image/jpeg")).toBe(false);
  });

  it("rejects application/x-rar-compressed", () => {
    expect(isAllowedProductFileType("application/x-rar-compressed")).toBe(false);
  });

  it("rejects application/x-7z-compressed", () => {
    expect(isAllowedProductFileType("application/x-7z-compressed")).toBe(false);
  });

  it("rejects application/octet-stream", () => {
    expect(isAllowedProductFileType("application/octet-stream")).toBe(false);
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

describe("File extension validation", () => {
  describe("isAllowedFileExtension", () => {
    it("accepts .docx", () => {
      expect(isAllowedFileExtension("report.docx")).toBe(true);
    });

    it("accepts .DOCX (case-insensitive)", () => {
      expect(isAllowedFileExtension("REPORT.DOCX")).toBe(true);
    });

    it("accepts .zip", () => {
      expect(isAllowedFileExtension("archive.zip")).toBe(true);
    });

    it("accepts .ZIP (uppercase)", () => {
      expect(isAllowedFileExtension("ARCHIVE.ZIP")).toBe(true);
    });

    it("rejects .doc (old format)", () => {
      expect(isAllowedFileExtension("file.doc")).toBe(false);
    });

    it("rejects .pdf", () => {
      expect(isAllowedFileExtension("file.pdf")).toBe(false);
    });

    it("rejects .rar", () => {
      expect(isAllowedFileExtension("file.rar")).toBe(false);
    });

    it("rejects .7z", () => {
      expect(isAllowedFileExtension("file.7z")).toBe(false);
    });

    it("rejects .exe", () => {
      expect(isAllowedFileExtension("file.exe")).toBe(false);
    });

    it("rejects no extension", () => {
      expect(isAllowedFileExtension("file")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isAllowedFileExtension("")).toBe(false);
    });
  });

  describe("isDocxExtension (deprecated compat)", () => {
    it("accepts .docx", () => {
      expect(isDocxExtension("report.docx")).toBe(true);
    });

    it("accepts .DOCX (case-insensitive)", () => {
      expect(isDocxExtension("REPORT.DOCX")).toBe(true);
    });

    it("rejects .zip", () => {
      expect(isDocxExtension("archive.zip")).toBe(false);
    });
  });
});

// ─── Dangerous Extension Blocklist ────────────────────────────────

describe("Dangerous extension blocklist", () => {
  it("blocks .exe", () => {
    expect(isDangerousExtension("malware.exe")).toBe(true);
  });

  it("blocks .bat", () => {
    expect(isDangerousExtension("script.bat")).toBe(true);
  });

  it("blocks .cmd", () => {
    expect(isDangerousExtension("run.cmd")).toBe(true);
  });

  it("blocks .scr", () => {
    expect(isDangerousExtension("screen.scr")).toBe(true);
  });

  it("blocks .js", () => {
    expect(isDangerousExtension("hack.js")).toBe(true);
  });

  it("blocks .vbs", () => {
    expect(isDangerousExtension("virus.vbs")).toBe(true);
  });

  it("blocks .ps1", () => {
    expect(isDangerousExtension("powershell.ps1")).toBe(true);
  });

  it("blocks .rar (unsupported archive)", () => {
    expect(isDangerousExtension("file.rar")).toBe(true);
  });

  it("blocks .7z (unsupported archive)", () => {
    expect(isDangerousExtension("file.7z")).toBe(true);
  });

  it("does NOT block .docx", () => {
    expect(isDangerousExtension("file.docx")).toBe(false);
  });

  it("does NOT block .zip", () => {
    expect(isDangerousExtension("file.zip")).toBe(false);
  });
});

// ─── Extension Helpers ────────────────────────────────────────────

describe("getFileExtension", () => {
  it("extracts .docx", () => {
    expect(getFileExtension("report.docx")).toBe(".docx");
  });

  it("extracts .zip", () => {
    expect(getFileExtension("archive.zip")).toBe(".zip");
  });

  it("handles uppercase", () => {
    expect(getFileExtension("FILE.ZIP")).toBe(".zip");
  });

  it("returns empty for no extension", () => {
    expect(getFileExtension("file")).toBe("");
  });

  it("returns empty for empty string", () => {
    expect(getFileExtension("")).toBe("");
  });

  it("handles multiple dots", () => {
    expect(getFileExtension("my.report.v2.docx")).toBe(".docx");
  });
});

describe("getFormatLabel", () => {
  it("returns DOCX for .docx file", () => {
    expect(getFormatLabel("report.docx")).toBe("DOCX");
  });

  it("returns ZIP for .zip file", () => {
    expect(getFormatLabel("archive.zip")).toBe("ZIP");
  });

  it("returns FILE for no extension", () => {
    expect(getFormatLabel("noext")).toBe("FILE");
  });
});

// ─── Safe Extension Validation ────────────────────────────────────

describe("getSafeExtension", () => {
  it("returns docx for valid DOCX file", () => {
    expect(
      getSafeExtension(
        "report.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
  });

  it("returns zip for valid ZIP with application/zip", () => {
    expect(getSafeExtension("archive.zip", "application/zip")).toBe("zip");
  });

  it("returns zip for valid ZIP with x-zip-compressed", () => {
    expect(getSafeExtension("archive.zip", "application/x-zip-compressed")).toBe("zip");
  });

  it("rejects .exe even with valid MIME", () => {
    expect(getSafeExtension("hack.exe", "application/zip")).toBeNull();
  });

  it("rejects .zip with DOCX MIME (mismatch)", () => {
    expect(
      getSafeExtension(
        "fake.zip",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBeNull();
  });

  it("rejects .docx with ZIP MIME (mismatch)", () => {
    expect(getSafeExtension("fake.docx", "application/zip")).toBeNull();
  });

  it("rejects no extension", () => {
    expect(getSafeExtension("noext", "application/zip")).toBeNull();
  });

  it("rejects .rar extension", () => {
    expect(getSafeExtension("file.rar", "application/x-rar-compressed")).toBeNull();
  });
});

// ─── Full File Validation ─────────────────────────────────────────

describe("validateProductFile", () => {
  const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const ZIP_MIME = "application/zip";
  const SMALL_SIZE = 1024; // 1 KB
  const MAX_SIZE = MAX_PRODUCT_FILE_SIZE;
  const OVER_SIZE = MAX_SIZE + 1;

  it("accepts valid DOCX", () => {
    expect(validateProductFile("doc.docx", DOCX_MIME, SMALL_SIZE)).toBeNull();
  });

  it("accepts valid ZIP", () => {
    expect(validateProductFile("archive.zip", ZIP_MIME, SMALL_SIZE)).toBeNull();
  });

  it("accepts ZIP at exactly max size", () => {
    expect(validateProductFile("big.zip", ZIP_MIME, MAX_SIZE)).toBeNull();
  });

  it("rejects file over max size", () => {
    const err = validateProductFile("big.zip", ZIP_MIME, OVER_SIZE);
    expect(err).toContain("50 MB");
  });

  it("rejects .exe", () => {
    const err = validateProductFile("virus.exe", "application/octet-stream", SMALL_SIZE);
    expect(err).toBeTruthy();
  });

  it("rejects .rar", () => {
    const err = validateProductFile("file.rar", "application/x-rar-compressed", SMALL_SIZE);
    expect(err).toBeTruthy();
  });

  it("rejects MIME mismatch", () => {
    const err = validateProductFile("fake.docx", ZIP_MIME, SMALL_SIZE);
    expect(err).toBeTruthy();
  });
});

// ─── Constants Integrity ──────────────────────────────────────────

describe("Constants integrity", () => {
  it("ALLOWED_PRODUCT_FILE_MIMES includes DOCX", () => {
    expect(ALLOWED_PRODUCT_FILE_MIMES).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("ALLOWED_PRODUCT_FILE_MIMES includes application/zip", () => {
    expect(ALLOWED_PRODUCT_FILE_MIMES).toContain("application/zip");
  });

  it("ALLOWED_PRODUCT_FILE_MIMES includes application/x-zip-compressed", () => {
    expect(ALLOWED_PRODUCT_FILE_MIMES).toContain("application/x-zip-compressed");
  });

  it("ALLOWED_FILE_EXTENSIONS has .docx and .zip", () => {
    expect(Object.keys(ALLOWED_FILE_EXTENSIONS)).toContain(".docx");
    expect(Object.keys(ALLOWED_FILE_EXTENSIONS)).toContain(".zip");
  });

  it("DANGEROUS_EXTENSIONS includes .exe .js .bat .rar .7z", () => {
    expect(DANGEROUS_EXTENSIONS).toContain(".exe");
    expect(DANGEROUS_EXTENSIONS).toContain(".js");
    expect(DANGEROUS_EXTENSIONS).toContain(".bat");
    expect(DANGEROUS_EXTENSIONS).toContain(".rar");
    expect(DANGEROUS_EXTENSIONS).toContain(".7z");
  });

  it("MAX_PRODUCT_FILE_SIZE is 50 MB", () => {
    expect(CONST_MAX_SIZE).toBe(50 * 1024 * 1024);
  });
});
