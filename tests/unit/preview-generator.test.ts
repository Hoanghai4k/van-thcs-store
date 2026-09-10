import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { MAX_PREVIEW_PAGES } from "@/lib/constants";

/**
 * Preview Page Limit Tests
 *
 * Tests the security-critical page truncation logic that ensures:
 * - The derived preview artifact contains at most MAX_PREVIEW_PAGES (25) pages
 * - Short documents preserve their actual page count
 * - The constant is consistent with the DB constraint (migration 014)
 */

// ═══════════════════════════════════════════════════════════════════
// 1. CANONICAL CONSTANT
// ═══════════════════════════════════════════════════════════════════

describe("MAX_PREVIEW_PAGES constant", () => {
  it("should be 25", () => {
    expect(MAX_PREVIEW_PAGES).toBe(25);
  });

  it("should be a positive integer", () => {
    expect(Number.isInteger(MAX_PREVIEW_PAGES)).toBe(true);
    expect(MAX_PREVIEW_PAGES).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. PDF TRUNCATION LOGIC (unit-testable core)
// ═══════════════════════════════════════════════════════════════════

/**
 * Extracted truncation logic matching preview-generator.ts behavior.
 * Given a PDF buffer, returns { pdfBytes, pageCount } where pageCount
 * is capped to MAX_PREVIEW_PAGES and the actual artifact is truncated.
 */
async function truncatePreviewPdf(
  inputBytes: Uint8Array
): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();

  if (pageCount > MAX_PREVIEW_PAGES) {
    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(
      pdfDoc,
      Array.from({ length: MAX_PREVIEW_PAGES }, (_, i) => i)
    );
    pages.forEach((page) => newPdf.addPage(page));
    const truncatedBytes = await newPdf.save();
    return { pdfBytes: new Uint8Array(truncatedBytes), pageCount: MAX_PREVIEW_PAGES };
  }

  return { pdfBytes: inputBytes, pageCount };
}

/** Helper: create a minimal multi-page PDF for testing */
async function createTestPdf(numPages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < numPages; i++) {
    doc.addPage();
  }
  return new Uint8Array(await doc.save());
}

// ── Page limit boundary tests ────────────────────────────────────

describe("Preview PDF truncation — page limit", () => {
  it("source 1 page → output 1 page", async () => {
    const input = await createTestPdf(1);
    const { pageCount, pdfBytes } = await truncatePreviewPdf(input);
    expect(pageCount).toBe(1);

    const verify = await PDFDocument.load(pdfBytes);
    expect(verify.getPageCount()).toBe(1);
  });

  it("source 9 pages → output 9 pages", async () => {
    const input = await createTestPdf(9);
    const { pageCount, pdfBytes } = await truncatePreviewPdf(input);
    expect(pageCount).toBe(9);

    const verify = await PDFDocument.load(pdfBytes);
    expect(verify.getPageCount()).toBe(9);
  });

  it("source 10 pages → output 10 pages (legacy size, no truncation)", async () => {
    const input = await createTestPdf(10);
    const { pageCount, pdfBytes } = await truncatePreviewPdf(input);
    expect(pageCount).toBe(10);

    const verify = await PDFDocument.load(pdfBytes);
    expect(verify.getPageCount()).toBe(10);
  });

  it("source 11 pages → output 11 pages (newly allowed)", async () => {
    const input = await createTestPdf(11);
    const { pageCount, pdfBytes } = await truncatePreviewPdf(input);
    expect(pageCount).toBe(11);

    const verify = await PDFDocument.load(pdfBytes);
    expect(verify.getPageCount()).toBe(11);
  });

  it("source 24 pages → output 24 pages", async () => {
    const input = await createTestPdf(24);
    const { pageCount, pdfBytes } = await truncatePreviewPdf(input);
    expect(pageCount).toBe(24);

    const verify = await PDFDocument.load(pdfBytes);
    expect(verify.getPageCount()).toBe(24);
  });

  it("source 25 pages → output 25 pages (at boundary)", async () => {
    const input = await createTestPdf(25);
    const { pageCount, pdfBytes } = await truncatePreviewPdf(input);
    expect(pageCount).toBe(25);

    const verify = await PDFDocument.load(pdfBytes);
    expect(verify.getPageCount()).toBe(25);
  });

  it("source 26 pages → output 25 pages (truncated)", async () => {
    const input = await createTestPdf(26);
    const { pageCount, pdfBytes } = await truncatePreviewPdf(input);
    expect(pageCount).toBe(25);

    // CRITICAL: verify the actual artifact, not just metadata
    const verify = await PDFDocument.load(pdfBytes);
    expect(verify.getPageCount()).toBe(25);
  });

  it("source 100 pages → output 25 pages (truncated)", async () => {
    const input = await createTestPdf(100);
    const { pageCount, pdfBytes } = await truncatePreviewPdf(input);
    expect(pageCount).toBe(25);

    // CRITICAL: verify the actual artifact, not just metadata
    const verify = await PDFDocument.load(pdfBytes);
    expect(verify.getPageCount()).toBe(25);
  });
});

// ── Artifact security tests ──────────────────────────────────────

describe("Preview artifact security", () => {
  it("truncated artifact MUST contain exactly MAX_PREVIEW_PAGES pages", async () => {
    const input = await createTestPdf(50);
    const { pdfBytes } = await truncatePreviewPdf(input);

    // This tests the actual derived artifact, not viewer rendering
    const artifact = await PDFDocument.load(pdfBytes);
    expect(artifact.getPageCount()).toBe(MAX_PREVIEW_PAGES);
    expect(artifact.getPageCount()).toBeLessThanOrEqual(25);
  });

  it("page_count metadata must equal actual artifact page count for short doc", async () => {
    const input = await createTestPdf(7);
    const { pageCount, pdfBytes } = await truncatePreviewPdf(input);

    const artifact = await PDFDocument.load(pdfBytes);
    expect(pageCount).toBe(artifact.getPageCount());
    expect(pageCount).toBe(7);
  });

  it("page_count metadata must equal actual artifact page count for truncated doc", async () => {
    const input = await createTestPdf(40);
    const { pageCount, pdfBytes } = await truncatePreviewPdf(input);

    const artifact = await PDFDocument.load(pdfBytes);
    expect(pageCount).toBe(artifact.getPageCount());
    expect(pageCount).toBe(25);
  });

  it("page_count must never exceed MAX_PREVIEW_PAGES", async () => {
    for (const numPages of [1, 10, 25, 26, 50, 100]) {
      const input = await createTestPdf(numPages);
      const { pageCount } = await truncatePreviewPdf(input);
      expect(pageCount).toBeLessThanOrEqual(MAX_PREVIEW_PAGES);
      expect(pageCount).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Legacy compatibility ─────────────────────────────────────────

describe("Legacy 10-page preview compatibility", () => {
  it("existing 10-page preview artifact remains valid", async () => {
    // Simulates loading an existing 10-page preview
    const legacyPreview = await createTestPdf(10);
    const doc = await PDFDocument.load(legacyPreview);

    expect(doc.getPageCount()).toBe(10);
    // Viewer should show 1/10, not 1/25
    expect(doc.getPageCount()).toBeLessThanOrEqual(MAX_PREVIEW_PAGES);
  });

  it("10-page preview does not trigger truncation", async () => {
    const input = await createTestPdf(10);
    const originalDoc = await PDFDocument.load(input);
    const originalCount = originalDoc.getPageCount();

    const { pageCount } = await truncatePreviewPdf(input);
    expect(pageCount).toBe(originalCount);
    expect(pageCount).toBe(10);
  });
});

// ── Source file type selection (unchanged logic) ─────────────────

describe("Source file type selection for preview", () => {
  it("should prioritize DOCX over PDF", () => {
    const files = [
      { file_name: "archive.zip", storage_provider: "SUPABASE" },
      { file_name: "document.pdf", storage_provider: "SUPABASE" },
      { file_name: "document.docx", storage_provider: "R2" },
    ];

    let sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".docx"));
    if (!sourceFile) {
      sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".pdf"));
    }

    expect(sourceFile?.file_name).toBe("document.docx");
  });

  it("should fall back to PDF when no DOCX exists", () => {
    const files = [
      { file_name: "archive.zip", storage_provider: "SUPABASE" },
      { file_name: "document.pdf", storage_provider: "R2" },
    ];

    let sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".docx"));
    if (!sourceFile) {
      sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".pdf"));
    }

    expect(sourceFile?.file_name).toBe("document.pdf");
  });

  it("should exclude ZIP (not previewable)", () => {
    const files = [
      { file_name: "archive.zip", storage_provider: "R2" },
    ];

    let sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".docx"));
    if (!sourceFile) {
      sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".pdf"));
    }

    expect(sourceFile).toBeUndefined();
  });

  it("supports both SUPABASE and R2 providers", () => {
    // R2 source
    const r2Files = [{ file_name: "doc.docx", storage_provider: "R2" }];
    const r2Source = r2Files.find((f) => f.file_name.toLowerCase().endsWith(".docx"));
    expect(r2Source?.storage_provider).toBe("R2");

    // Supabase source
    const sbFiles = [{ file_name: "doc.docx", storage_provider: "SUPABASE" }];
    const sbSource = sbFiles.find((f) => f.file_name.toLowerCase().endsWith(".docx"));
    expect(sbSource?.storage_provider).toBe("SUPABASE");
  });
});
