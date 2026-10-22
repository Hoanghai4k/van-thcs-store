import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolve, join } from "node:path";
import { readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { renderPdf } from "../src/pdf-renderer.js";
import { preflightPdfDocument } from "../src/pdf-preflight.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import { RendererError } from "../src/errors.js";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");
const TEST_OUTPUT_ROOT = resolve(__dirname, "../output/test-guards");

describe("Phase 2E — Resource Guards & Malformed PDF Handling", () => {
  beforeAll(async () => {
    await mkdir(TEST_OUTPUT_ROOT, { recursive: true });
  });

  afterAll(async () => {
    try {
      await rm(TEST_OUTPUT_ROOT, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  it("rejects non-existent source path with INVALID_SOURCE_PATH", async () => {
    const bogusPath = join(FIXTURES_DIR, "non-existent-doc.pdf");
    await expect(
      renderPdf({
        inputPath: bogusPath,
        displayName: "Bogus",
        outputRoot: TEST_OUTPUT_ROOT,
      })
    ).rejects.toThrowError(RendererError);

    try {
      await renderPdf({
        inputPath: bogusPath,
        displayName: "Bogus",
        outputRoot: TEST_OUTPUT_ROOT,
      });
    } catch (err: any) {
      expect(err.code).toBe("INVALID_SOURCE_PATH");
    }
  });

  it("rejects unsupported file extension with UNSUPPORTED_FORMAT", async () => {
    const txtPath = join(TEST_OUTPUT_ROOT, "sample.txt");
    await writeFile(txtPath, "Hello world text file");

    try {
      await renderPdf({
        inputPath: txtPath,
        displayName: "Text File",
        outputRoot: TEST_OUTPUT_ROOT,
      });
      expect.fail("Should have thrown UNSUPPORTED_FORMAT");
    } catch (err: any) {
      expect(err).toBeInstanceOf(RendererError);
      expect(err.code).toBe("UNSUPPORTED_FORMAT");
    }
  });

  it("rejects empty (0-byte) source file with EMPTY_SOURCE_FILE", async () => {
    const emptyPdfPath = join(FIXTURES_DIR, "empty-file.pdf");

    try {
      await renderPdf({
        inputPath: emptyPdfPath,
        displayName: "Empty Document",
        outputRoot: TEST_OUTPUT_ROOT,
      });
      expect.fail("Should have thrown EMPTY_SOURCE_FILE");
    } catch (err: any) {
      expect(err).toBeInstanceOf(RendererError);
      expect(err.code).toBe("EMPTY_SOURCE_FILE");
    }
  });

  it("rejects corrupt PDF bytes with CORRUPT_PDF", async () => {
    const corruptPdfPath = join(FIXTURES_DIR, "corrupt-file.pdf");

    try {
      await renderPdf({
        inputPath: corruptPdfPath,
        displayName: "Corrupt Document",
        outputRoot: TEST_OUTPUT_ROOT,
      });
      expect.fail("Should have thrown CORRUPT_PDF");
    } catch (err: any) {
      expect(err).toBeInstanceOf(RendererError);
      expect(err.code).toBe("CORRUPT_PDF");
    }
  });

  it("rejects oversized source when exceeding maxSourceBytes limit", async () => {
    const standardPdf = join(FIXTURES_DIR, "standard-lesson-3p.pdf");

    // Override maxSourceBytes to very low value (e.g. 50 bytes)
    try {
      await renderPdf({
        inputPath: standardPdf,
        displayName: "Oversized Test",
        outputRoot: TEST_OUTPUT_ROOT,
        configOverrides: {
          maxSourceBytes: 50,
        },
      });
      expect.fail("Should have thrown SOURCE_EXCEEDS_SIZE_LIMIT");
    } catch (err: any) {
      expect(err).toBeInstanceOf(RendererError);
      expect(err.code).toBe("SOURCE_EXCEEDS_SIZE_LIMIT");
    }
  });

  it("rejects document when page count exceeds maxPdfPages limit", async () => {
    const standardPdf = join(FIXTURES_DIR, "standard-lesson-3p.pdf"); // 3 pages

    // Override maxPdfPages to 2
    try {
      await renderPdf({
        inputPath: standardPdf,
        displayName: "Page Limit Test",
        outputRoot: TEST_OUTPUT_ROOT,
        configOverrides: {
          maxPdfPages: 2,
        },
      });
      expect.fail("Should have thrown PAGE_COUNT_EXCEEDS_LIMIT");
    } catch (err: any) {
      expect(err).toBeInstanceOf(RendererError);
      expect(err.code).toBe("PAGE_COUNT_EXCEEDS_LIMIT");
    }
  });

  it("rejects document when dimensions exceed maxRenderPixelsPerPage", async () => {
    const standardPdf = join(FIXTURES_DIR, "standard-lesson-3p.pdf");

    // Standard width 1600px * ~2263px height = ~3.6M pixels.
    // Set limit to 100,000 pixels.
    try {
      await renderPdf({
        inputPath: standardPdf,
        displayName: "Pixel Limit Test",
        outputRoot: TEST_OUTPUT_ROOT,
        configOverrides: {
          maxRenderPixelsPerPage: 100_000,
        },
      });
      expect.fail("Should have thrown DIMENSIONS_EXCEED_LIMIT");
    } catch (err: any) {
      expect(err).toBeInstanceOf(RendererError);
      expect(err.code).toBe("DIMENSIONS_EXCEED_LIMIT");
    }
  });

  it("rejects invalid request parameters (webpQuality, pageWidth, rendererVersion)", async () => {
    const standardPdf = join(FIXTURES_DIR, "standard-lesson-3p.pdf");

    // Invalid quality 105
    await expect(
      renderPdf({
        inputPath: standardPdf,
        displayName: "Invalid Quality",
        outputRoot: TEST_OUTPUT_ROOT,
        webpQuality: 105,
      })
    ).rejects.toThrowError(/Invalid webpQuality/);

    // Invalid pageWidth 100 (< min 400)
    await expect(
      renderPdf({
        inputPath: standardPdf,
        displayName: "Invalid Width",
        outputRoot: TEST_OUTPUT_ROOT,
        pageWidth: 100,
      })
    ).rejects.toThrowError(/Invalid pageWidth/);

    // Invalid empty rendererVersion
    await expect(
      renderPdf({
        inputPath: standardPdf,
        displayName: "Invalid Version",
        outputRoot: TEST_OUTPUT_ROOT,
        rendererVersion: "   ",
      })
    ).rejects.toThrowError(/Invalid rendererVersion/);
  });

  it("enforces timeout and cleans up partial staging directory on failure", async () => {
    const standardPdf = join(FIXTURES_DIR, "standard-lesson-3p.pdf");

    // Set timeoutMs to 1ms to force immediate timeout during execution
    try {
      await renderPdf({
        inputPath: standardPdf,
        displayName: "Timeout Test",
        outputRoot: TEST_OUTPUT_ROOT,
        timeoutMs: 1,
      });
      expect.fail("Should have thrown RENDER_TIMEOUT");
    } catch (err: any) {
      expect(err).toBeInstanceOf(RendererError);
      expect(err.code).toBe("RENDER_TIMEOUT");
    }

    // Verify staging directory was cleaned up and no partial artifacts were left
    const rootFiles = await readdir(TEST_OUTPUT_ROOT);
    const stagingFolders = rootFiles.filter((f) => f.startsWith(".staging"));
    expect(stagingFolders).toHaveLength(0);
  });
});
