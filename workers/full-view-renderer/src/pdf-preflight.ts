import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { RendererConfig } from "./config.js";
import { RendererError } from "./errors.js";
import { computeSourceSha256 } from "./hash.js";

export interface PdfPageProxyLike {
  getViewport(params: { scale: number }): { width: number; height: number };
  cleanup?: () => void;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: unknown;
  }): { promise: Promise<void> };
}

export interface PdfDocumentProxyLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxyLike>;
}

export interface PdfPreflightResult {
  sourceSha256: string;
  sourceSizeBytes: number;
  pageCount: number;
  pdfDoc: PdfDocumentProxyLike;
}

/**
 * Executes strict preflight security and resource boundary checks on an input PDF.
 *
 * Guarantees before any rendering starts:
 * 1. File exists, is regular file, and size > 0
 * 2. File size does not exceed maxSourceBytes
 * 3. SHA-256 byte hash is computed and validated
 * 4. Document can be parsed as a valid PDF
 * 5. Page count >= 1 and does not exceed maxPdfPages
 * 6. Page count does not exceed naming boundary (9999)
 * 7. Page dimensions under target scale do not exceed maxRenderPixelsPerPage
 */
export async function preflightPdfDocument(
  sourceFilePath: string,
  targetPageWidth: number,
  config: RendererConfig
): Promise<PdfPreflightResult> {
  const resolvedPath = resolve(sourceFilePath);
  const ext = extname(resolvedPath).toLowerCase();

  if (ext !== ".pdf") {
    throw new RendererError(
      "UNSUPPORTED_FORMAT",
      `Unsupported file extension '${ext}'. Full-view renderer core accepts .pdf only.`
    );
  }

  // 1. File stat & size checks
  let fileStats;
  try {
    fileStats = await stat(resolvedPath);
  } catch (err) {
    throw new RendererError("INVALID_SOURCE_PATH", `Cannot access source file: ${resolvedPath}`, err);
  }

  if (!fileStats.isFile()) {
    throw new RendererError("INVALID_SOURCE_PATH", `Source path is not a file: ${resolvedPath}`);
  }

  if (fileStats.size === 0) {
    throw new RendererError("EMPTY_SOURCE_FILE", `Source PDF is empty (0 bytes): ${resolvedPath}`);
  }

  if (fileStats.size > config.maxSourceBytes) {
    throw new RendererError(
      "SOURCE_EXCEEDS_SIZE_LIMIT",
      `Source PDF size (${fileStats.size} bytes) exceeds configured limit (${config.maxSourceBytes} bytes)`
    );
  }

  // 2. Hash computation
  const sourceSha256 = await computeSourceSha256(resolvedPath);

  // 3. Load PDF via Mozilla pdfjs-dist
  let pdfDoc: PdfDocumentProxyLike;
  try {
    const { readFile } = await import("node:fs/promises");
    const pdfBytes = await readFile(resolvedPath);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBytes),
      useSystemFonts: true,
      standardFontDataUrl: undefined,
    });

    pdfDoc = (await loadingTask.promise) as unknown as PdfDocumentProxyLike;
  } catch (err) {
    throw new RendererError("CORRUPT_PDF", `Failed to parse PDF document: ${resolvedPath}`, err);
  }

  // 4. Page count validation
  const pageCount = pdfDoc.numPages;

  if (pageCount === 0) {
    throw new RendererError("ZERO_PAGE_DOCUMENT", `Source PDF contains 0 pages: ${resolvedPath}`);
  }

  if (pageCount > config.maxPdfPages) {
    throw new RendererError(
      "PAGE_COUNT_EXCEEDS_LIMIT",
      `Document has ${pageCount} pages, exceeding configured limit of ${config.maxPdfPages} pages`
    );
  }

  if (pageCount > config.maxPageNumber) {
    throw new RendererError(
      "PAGE_COUNT_EXCEEDS_NAMING_LIMIT",
      `Document has ${pageCount} pages, exceeding deterministic naming boundary (${config.maxPageNumber})`
    );
  }

  // 5. Dimension inspection for each page before canvas allocation
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    let page: PdfPageProxyLike | null = null;
    try {
      page = await pdfDoc.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1.0 });

      if (baseViewport.width <= 0 || baseViewport.height <= 0) {
        throw new RendererError(
          "DIMENSIONS_EXCEED_LIMIT",
          `Invalid zero or negative page viewport dimensions on page ${pageNum}: ${baseViewport.width}x${baseViewport.height}`
        );
      }

      const scale = targetPageWidth / baseViewport.width;
      const targetWidth = Math.round(baseViewport.width * scale);
      const targetHeight = Math.round(baseViewport.height * scale);
      const renderedPixels = targetWidth * targetHeight;

      if (renderedPixels > config.maxRenderPixelsPerPage) {
        throw new RendererError(
          "DIMENSIONS_EXCEED_LIMIT",
          `Page ${pageNum} rendered pixel area (${targetWidth}x${targetHeight} = ${renderedPixels} px) exceeds safety limit (${config.maxRenderPixelsPerPage} px)`
        );
      }
    } finally {
      if (page && typeof page.cleanup === "function") {
        page.cleanup();
      }
    }
  }

  return {
    sourceSha256,
    sourceSizeBytes: fileStats.size,
    pageCount,
    pdfDoc,
  };
}
