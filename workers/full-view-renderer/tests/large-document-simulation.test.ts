import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolve, join } from "node:path";
import { readdir, rm, stat, mkdir } from "node:fs/promises";
import { renderPdf } from "../src/pdf-renderer.js";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");
const TEST_OUTPUT_ROOT = resolve(__dirname, "../output/test-large-doc");

describe("Phase 2E — Large-Document Simulation (30-page Synthetic PDF)", () => {
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

  it("renders 30-page synthetic document under bounded concurrency (2 workers) and collects telemetry", async () => {
    const largePdf = join(FIXTURES_DIR, "synthetic-large-30p.pdf");

    const initialMemory = process.memoryUsage().rss;

    const result = await renderPdf({
      inputPath: largePdf,
      displayName: "Tai Lieu On Thi Vao Lop 10 (30 Trang)",
      outputRoot: TEST_OUTPUT_ROOT,
      pageWidth: 1600,
      webpQuality: 85,
      concurrency: 2, // Strict 2-worker concurrency
    });

    // 1. Result verification
    expect(result.status).toBe("READY");
    expect(result.pageCount).toBe(30);

    // 2. Artifact completeness verification
    const docDir = join(result.localOutputDirectory, "doc-0001");
    const files = await readdir(docDir);
    expect(files).toHaveLength(30);

    // Verify sequential naming from page-0001.webp to page-0030.webp
    for (let i = 1; i <= 30; i++) {
      const expectedFilename = `page-${i.toString().padStart(4, "0")}.webp`;
      expect(files).toContain(expectedFilename);

      const pageStat = await stat(join(docDir, expectedFilename));
      expect(pageStat.size).toBeGreaterThan(1000);
    }

    // 3. Telemetry assertions
    const metrics = result.metrics;
    expect(metrics.totalDurationMs).toBeGreaterThan(0);
    expect(metrics.sourceSizeBytes).toBeGreaterThan(0);
    expect(metrics.totalWebpSizeBytes).toBeGreaterThan(0);
    expect(metrics.meanPageSizeBytes).toBeGreaterThan(0);
    expect(metrics.minPageSizeBytes).toBeGreaterThan(0);
    expect(metrics.maxPageSizeBytes).toBeGreaterThanOrEqual(metrics.minPageSizeBytes);
    expect(metrics.pageMeasurements).toHaveLength(30);

    // 4. Log telemetry for Phase 2E final report
    console.log("=== Phase 2E Large-Document Simulation Telemetry ===");
    console.log(`Page count:           ${result.pageCount}`);
    console.log(`Total duration:       ${metrics.totalDurationMs} ms (${(metrics.totalDurationMs / 1000).toFixed(2)} s)`);
    console.log(`Average per page:     ${(metrics.totalDurationMs / result.pageCount).toFixed(1)} ms/page`);
    console.log(`Source size:          ${(metrics.sourceSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`Total WebP output:    ${(metrics.totalWebpSizeBytes / 1024).toFixed(1)} KB (${(metrics.totalWebpSizeBytes / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`Mean page size:       ${(metrics.meanPageSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`Min page size:        ${(metrics.minPageSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`Max page size:        ${(metrics.maxPageSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`Peak process RSS:     ${((metrics.peakMemoryBytes ?? process.memoryUsage().rss) / (1024 * 1024)).toFixed(1)} MB`);
    console.log("====================================================");
  }, 60000); // 60s timeout allowance for 30 page rasterization
});
