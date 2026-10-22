import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve, basename, extname, join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { computeSourceSha256 } from "./hash.js";
import {
  formatPageFilename,
  validateArtifactMetadata,
  type FullViewArtifactMetadata,
  type DocumentManifestItem,
} from "./manifest.js";
import { convertDocxToPdf, cleanupIntermediateFile } from "./docx-adapter.js";

export interface RenderOptions {
  pageWidth?: number;
  webpQuality?: number;
  rendererVersion?: string;
  outputRootDir?: string;
  displayName?: string;
}

export interface PageRenderMeasurement {
  pageNumber: number;
  filename: string;
  width: number;
  height: number;
  fileSizeBytes: number;
}

export interface RenderResult {
  success: boolean;
  sourceSha256: string;
  rendererVersion: string;
  pageCount: number;
  sourceSizeBytes: number;
  totalWebpSizeBytes: number;
  pageMeasurements: PageRenderMeasurement[];
  manifest: FullViewArtifactMetadata;
  outputDirectory: string;
  manifestFilePath: string;
  error?: string;
}

/**
 * Core Full View Renderer Pipeline.
 * Converts input PDF (or DOCX via adapter) to high-resolution page-level WebP images
 * and generates a deterministic document manifest compatible with Migration 016.
 */
export async function renderDocument(
  sourceFilePath: string,
  options?: RenderOptions
): Promise<RenderResult> {
  const resolvedSourcePath = resolve(sourceFilePath);
  const ext = extname(resolvedSourcePath).toLowerCase();

  const pageWidth = options?.pageWidth ?? 1600;
  const webpQuality = options?.webpQuality ?? 85;
  const rendererVersion = options?.rendererVersion ?? "webp-poc-v1";
  const outputRootDir = options?.outputRootDir ?? resolve(process.cwd(), "output");
  const rawBaseName = basename(resolvedSourcePath, ext);
  const displayName = options?.displayName ?? rawBaseName.replace(/[-_]/g, " ");

  // 1. Verify source file exists
  const sourceStats = await stat(resolvedSourcePath);
  if (!sourceStats.isFile()) {
    throw new Error(`Source path is not a valid file: ${resolvedSourcePath}`);
  }

  // 2. Compute SHA-256 strictly from raw file bytes
  const sourceSha256 = await computeSourceSha256(resolvedSourcePath);

  let activePdfPath = resolvedSourcePath;
  let intermediatePdfToCleanup: string | null = null;

  // 3. Handle DOCX conversion if needed
  if (ext === ".docx") {
    const tempDir = resolve(outputRootDir, ".temp", sourceSha256);
    await mkdir(tempDir, { recursive: true });
    const conversion = await convertDocxToPdf(resolvedSourcePath, tempDir);
    if (!conversion.success) {
      throw new Error(conversion.message || conversion.error || "DOCX conversion failed");
    }
    activePdfPath = resolve(tempDir, `${rawBaseName}.pdf`);
    intermediatePdfToCleanup = activePdfPath;
  } else if (ext !== ".pdf") {
    throw new Error(`Unsupported input format '${ext}'. Expected .pdf or .docx`);
  }

  try {
    // 4. Load PDF via Mozilla pdfjs-dist
    const pdfBytes = await readFile(activePdfPath);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBytes),
      useSystemFonts: true,
      standardFontDataUrl: undefined,
    });
    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;

    if (pageCount < 1) {
      throw new Error("Source PDF contains 0 pages.");
    }

    // 5. Prepare deterministic output paths
    const docKey = "doc-0001";
    const artifactDir = resolve(outputRootDir, sourceSha256, rendererVersion);
    const pagesDir = resolve(artifactDir, docKey);
    await mkdir(pagesDir, { recursive: true });

    const pageMeasurements: PageRenderMeasurement[] = [];
    let totalWebpSizeBytes = 0;

    // 6. Rasterize each page sequentially to high-resolution WebP
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1.0 });

      // Compute scale factor to match configured page width
      const scale = pageWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      const canvasWidth = Math.round(viewport.width);
      const canvasHeight = Math.round(viewport.height);

      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext("2d");

      // Set white background default
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Render page onto canvas
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;

      // Encode canvas buffer directly to WebP
      const webpBuffer = await canvas.encode("webp", webpQuality);
      const pageFilename = formatPageFilename(pageNum);
      const targetFilePath = join(pagesDir, pageFilename);

      await writeFile(targetFilePath, webpBuffer);

      const fileSize = webpBuffer.length;
      totalWebpSizeBytes += fileSize;

      pageMeasurements.push({
        pageNumber: pageNum,
        filename: pageFilename,
        width: canvasWidth,
        height: canvasHeight,
        fileSizeBytes: fileSize,
      });
    }

    // 7. Assemble Document Manifest
    const manifestItem: DocumentManifestItem = {
      key: docKey,
      name: displayName,
      pageCount,
    };

    const metadata: FullViewArtifactMetadata = {
      sourceSha256,
      rendererVersion,
      status: "READY",
      storageProvider: "R2",
      pageCount,
      documentManifest: [manifestItem],
      localOutputDirectory: artifactDir,
      errorCode: null,
      errorMessage: null,
    };

    // 8. Validate metadata against Migration 016 invariants
    const validation = validateArtifactMetadata(metadata);
    if (!validation.valid) {
      throw new Error(`Artifact metadata validation failed: ${validation.errors.join("; ")}`);
    }

    // 9. Write manifest.json
    const manifestFilePath = join(artifactDir, "manifest.json");
    await writeFile(manifestFilePath, JSON.stringify(metadata, null, 2), "utf8");

    return {
      success: true,
      sourceSha256,
      rendererVersion,
      pageCount,
      sourceSizeBytes: sourceStats.size,
      totalWebpSizeBytes,
      pageMeasurements,
      manifest: metadata,
      outputDirectory: artifactDir,
      manifestFilePath,
    };
  } finally {
    // 10. Clean intermediate PDF if one was created
    if (intermediatePdfToCleanup) {
      await cleanupIntermediateFile(intermediatePdfToCleanup);
    }
  }
}
