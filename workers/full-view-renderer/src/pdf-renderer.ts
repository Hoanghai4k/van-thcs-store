import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import { DEFAULT_CONFIG, type RendererConfig } from "./config.js";
import { RendererError } from "./errors.js";
import {
  createDefaultDocumentManifest,
  formatDocKey,
  formatPageFilename,
  validateRenderArtifacts,
} from "./manifest.js";
import { preflightPdfDocument, type PdfPageProxyLike } from "./pdf-preflight.js";
import type {
  PageRenderMeasurement,
  RenderMetrics,
  RenderRequest,
  RenderResult,
} from "./types.js";

/**
 * Executes an async task pool with bounded concurrency.
 * Ensures strictly limited concurrent workers to protect memory under high page counts.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await task(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Production PDF Full-View Renderer.
 *
 * Guarantees:
 * - Deterministic output layout: {outputRoot}/{sourceSha256}/{rendererVersion}/doc-0001/page-0001.webp
 * - Complete isolation from DB and remote storage (pure local artifact generator).
 * - Preflight validation before canvas allocation.
 * - Bounded concurrency (default 2 workers) for strict memory control.
 * - Resource cleanup per page (page.cleanup(), bitmap dereferencing).
 * - Overall render timeout with controlled RENDER_TIMEOUT error code.
 * - Atomic staging directory promotion: staging -> validate -> promote -> READY.
 * - Clean quarantine/removal of partial staging output on ANY failure.
 */
export async function renderPdf(request: RenderRequest): Promise<RenderResult> {
  const startTime = Date.now();
  const config: RendererConfig = {
    ...DEFAULT_CONFIG,
    ...(request.configOverrides || {}),
  };

  const rendererVersion = request.rendererVersion ?? config.rendererVersion;
  const pageWidth = request.pageWidth ?? config.defaultPageWidth;
  const webpQuality = request.webpQuality ?? config.defaultWebpQuality;
  const concurrency = Math.max(1, request.concurrency ?? config.defaultConcurrency);
  const timeoutMs = request.timeoutMs ?? config.defaultRenderTimeoutMs;

  // 1. Validate request inputs & parameters
  if (!rendererVersion || typeof rendererVersion !== "string" || rendererVersion.trim().length === 0) {
    throw new RendererError("VALIDATION_FAILURE", "Invalid rendererVersion: must be non-empty string");
  }

  if (pageWidth < config.minPageWidth || pageWidth > config.maxPageWidth) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      `Invalid pageWidth ${pageWidth}: must be between ${config.minPageWidth} and ${config.maxPageWidth}`
    );
  }

  if (webpQuality < config.minWebpQuality || webpQuality > config.maxWebpQuality) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      `Invalid webpQuality ${webpQuality}: must be between ${config.minWebpQuality} and ${config.maxWebpQuality}`
    );
  }

  const resolvedInputPath = resolve(request.inputPath);
  const resolvedOutputRoot = resolve(request.outputRoot);
  const displayName = request.displayName.trim() || "Document";

  // 2. Strict Preflight
  const preflight = await preflightPdfDocument(resolvedInputPath, pageWidth, config);
  const { sourceSha256, sourceSizeBytes, pageCount, pdfDoc } = preflight;

  // 3. Staging and Final Directory Paths
  const randomSuffix = randomBytes(4).toString("hex");
  const stagingDirName = `.staging_${sourceSha256}_${Date.now()}_${randomSuffix}`;
  const stagingDirectory = join(resolvedOutputRoot, stagingDirName);
  const docKey = formatDocKey(1);
  const stagingDocDirectory = join(stagingDirectory, docKey);
  const finalDirectory = join(resolvedOutputRoot, sourceSha256, rendererVersion);

  let stagingCreated = false;
  let isPromoted = false;

  // 4. Setup Timeout Watchdog
  let timeoutHandle: NodeJS.Timeout | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      reject(
        new RendererError(
          "RENDER_TIMEOUT",
          `Rendering timed out after ${timeoutMs}ms for document ${sourceSha256}`
        )
      );
    }, timeoutMs);
  });

  const renderWork = async (): Promise<RenderResult> => {
    try {
      await mkdir(stagingDocDirectory, { recursive: true });
      stagingCreated = true;

      if (timedOut) {
        throw new RendererError("RENDER_TIMEOUT", "Rendering cancelled due to timeout");
      }

      // Prepare list of 1-based page numbers
      const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);

      // Render pages with bounded concurrency
      const measurements: PageRenderMeasurement[] = await runWithConcurrency(
        pageNumbers,
        concurrency,
        async (pageNum) => {
          if (timedOut) {
            throw new RendererError("RENDER_TIMEOUT", "Rendering cancelled due to timeout");
          }

          const pageStart = Date.now();
          let page: PdfPageProxyLike | null = null;

          try {
            page = await pdfDoc.getPage(pageNum);
            const baseViewport = page.getViewport({ scale: 1.0 });
            const scale = pageWidth / baseViewport.width;
            const viewport = page.getViewport({ scale });

            const canvasWidth = Math.round(viewport.width);
            const canvasHeight = Math.round(viewport.height);

            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext("2d");

            // Fill solid white background default (prevents transparent PDF page issues)
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Render PDF onto canvas
            await page.render({
              canvasContext: ctx as unknown as CanvasRenderingContext2D,
              viewport,
            }).promise;

            if (timedOut) {
              throw new RendererError("RENDER_TIMEOUT", "Rendering cancelled due to timeout");
            }

            // Encode directly to WebP buffer
            const webpBuffer = await canvas.encode("webp", webpQuality);
            const filename = formatPageFilename(pageNum, config.maxPageNumber);
            const targetFilePath = join(stagingDocDirectory, filename);

            await writeFile(targetFilePath, webpBuffer);

            return {
              pageNumber: pageNum,
              filename,
              width: canvasWidth,
              height: canvasHeight,
              fileSizeBytes: webpBuffer.length,
              durationMs: Date.now() - pageStart,
            };
          } finally {
            // Explicit resource release per page
            if (page && typeof page.cleanup === "function") {
              page.cleanup();
            }
          }
        }
      );

      if (timedOut) {
        throw new RendererError("RENDER_TIMEOUT", "Rendering cancelled due to timeout");
      }

      // 5. Assemble and validate manifest
      const manifest = createDefaultDocumentManifest(displayName, pageCount);
      await validateRenderArtifacts(stagingDirectory, sourceSha256, pageCount, manifest);

      // Write manifest.json inside staging directory
      const stagingManifestPath = join(stagingDirectory, "manifest.json");
      await writeFile(
        stagingManifestPath,
        JSON.stringify(
          {
            sourceSha256,
            rendererVersion,
            status: "READY",
            pageCount,
            documentManifest: manifest,
            renderedAt: new Date().toISOString(),
          },
          null,
          2
        ),
        "utf8"
      );

      // 6. Atomic Promotion
      // Ensure target parent directory exists
      await mkdir(dirname(finalDirectory), { recursive: true });

      // If target finalDirectory already exists (e.g. from previous run), remove it cleanly first
      try {
        await rm(finalDirectory, { recursive: true, force: true });
      } catch {
        // Ignored
      }

      await rename(stagingDirectory, finalDirectory);
      isPromoted = true;

      // 7. Post-promotion verification on final destination
      await validateRenderArtifacts(finalDirectory, sourceSha256, pageCount, manifest);

      // 8. Calculate telemetry metrics
      const totalWebpSizeBytes = measurements.reduce((acc, m) => acc + m.fileSizeBytes, 0);
      const minPageSizeBytes = measurements.reduce((min, m) => Math.min(min, m.fileSizeBytes), Infinity);
      const maxPageSizeBytes = measurements.reduce((max, m) => Math.max(max, m.fileSizeBytes), 0);
      const meanPageSizeBytes = Math.round(totalWebpSizeBytes / pageCount);

      const metrics: RenderMetrics = {
        totalDurationMs: Date.now() - startTime,
        sourceSizeBytes,
        totalWebpSizeBytes,
        meanPageSizeBytes,
        minPageSizeBytes,
        maxPageSizeBytes,
        peakMemoryBytes: process.memoryUsage().rss,
        pageMeasurements: measurements,
      };

      return {
        sourceSha256,
        rendererVersion,
        status: "READY",
        pageCount,
        documentManifest: manifest,
        localOutputDirectory: finalDirectory,
        manifestFilePath: join(finalDirectory, "manifest.json"),
        metrics,
      };
    } finally {
      // 9. Staging cleanup guard: if not successfully promoted, remove staging directory
      if (stagingCreated && !isPromoted) {
        try {
          await rm(stagingDirectory, { recursive: true, force: true });
        } catch {
          // Non-fatal cleanup warning
        }
      }
    }
  };

  const workPromise = renderWork();

  try {
    return await Promise.race([workPromise, timeoutPromise]);
  } catch (err) {
    // If timed out or errored out, ensure background worker finishes its cleanup
    try {
      await workPromise;
    } catch {
      // Ignored: workPromise rejection handled
    }
    // Guarantee staging directory is deleted
    try {
      await rm(stagingDirectory, { recursive: true, force: true });
    } catch {
      // Ignored
    }
    throw err;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
