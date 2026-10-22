import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolve, join } from "node:path";
import { readdir, readFile, rm, stat, mkdir } from "node:fs/promises";
import { renderPdf } from "../src/pdf-renderer.js";
import { SHA256_HEX_REGEX } from "../src/hash.js";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");
const TEST_OUTPUT_ROOT = resolve(__dirname, "../output/test-rendering");

describe("Phase 2E — Mixed Geometry & Standard Document Rendering", () => {
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

  it("renders standard 3-page lesson plan to deterministic WebP artifacts", async () => {
    const standardPdf = join(FIXTURES_DIR, "standard-lesson-3p.pdf");

    const result = await renderPdf({
      inputPath: standardPdf,
      displayName: "Giao An Ngu Van 9",
      outputRoot: TEST_OUTPUT_ROOT,
      rendererVersion: "webp-prod-v1",
      pageWidth: 1600,
      webpQuality: 85,
      concurrency: 2,
    });

    // 1. Top level result assertions
    expect(result.status).toBe("READY");
    expect(result.rendererVersion).toBe("webp-prod-v1");
    expect(result.pageCount).toBe(3);
    expect(result.sourceSha256).toMatch(SHA256_HEX_REGEX);

    // 2. Deterministic output directory check
    const expectedDir = join(TEST_OUTPUT_ROOT, result.sourceSha256, "webp-prod-v1");
    expect(result.localOutputDirectory).toBe(expectedDir);

    // 3. Manifest file check
    const manifestStat = await stat(result.manifestFilePath);
    expect(manifestStat.isFile()).toBe(true);
    expect(manifestStat.size).toBeGreaterThan(0);

    const manifestContent = JSON.parse(await readFile(result.manifestFilePath, "utf8"));
    expect(manifestContent.status).toBe("READY");
    expect(manifestContent.pageCount).toBe(3);
    expect(manifestContent.documentManifest).toHaveLength(1);
    expect(manifestContent.documentManifest[0].key).toBe("doc-0001");
    expect(manifestContent.documentManifest[0].name).toBe("Giao An Ngu Van 9");
    expect(manifestContent.documentManifest[0].pageCount).toBe(3);

    // 4. Verify each WebP file exists, is non-empty, and correctly named
    const docDir = join(expectedDir, "doc-0001");
    const docFiles = (await readdir(docDir)).sort();
    expect(docFiles).toEqual(["page-0001.webp", "page-0002.webp", "page-0003.webp"]);

    for (const file of docFiles) {
      const fileStat = await stat(join(docDir, file));
      expect(fileStat.size).toBeGreaterThan(1024); // at least 1 KB for rendered page
    }

    // 5. Verify page measurements
    expect(result.metrics.pageMeasurements).toHaveLength(3);
    for (const m of result.metrics.pageMeasurements) {
      expect(m.width).toBe(1600);
      expect(m.height).toBeGreaterThan(2000); // Standard A4 portrait aspect ratio
      expect(m.fileSizeBytes).toBeGreaterThan(0);
    }
  });

  it("handles mixed geometry (portrait and landscape pages) preserving page-specific dimensions", async () => {
    const mixedPdf = join(FIXTURES_DIR, "mixed-geometry-3p.pdf");

    const result = await renderPdf({
      inputPath: mixedPdf,
      displayName: "Mixed Geometry Document",
      outputRoot: TEST_OUTPUT_ROOT,
      pageWidth: 1600,
      webpQuality: 80,
    });

    expect(result.status).toBe("READY");
    expect(result.pageCount).toBe(3);

    const measurements = result.metrics.pageMeasurements;
    expect(measurements).toHaveLength(3);

    // Page 1: Portrait A4 -> scaled width 1600, height > 1600
    const p1 = measurements[0];
    expect(p1.pageNumber).toBe(1);
    expect(p1.width).toBe(1600);
    expect(p1.height).toBeGreaterThan(1600); // Portrait: height > width

    // Page 2: Landscape A4 -> scaled width 1600, height < 1600
    const p2 = measurements[1];
    expect(p2.pageNumber).toBe(2);
    expect(p2.width).toBe(1600);
    expect(p2.height).toBeLessThan(1600); // Landscape: height < width

    // Ratio comparison:
    // Page 1 height / width should be ~ 1.414 (A4 sqrt(2))
    const p1Ratio = p1.height / p1.width;
    expect(p1Ratio).toBeGreaterThan(1.35);
    expect(p1Ratio).toBeLessThan(1.45);

    // Page 2 height / width should be ~ 0.707 (1 / sqrt(2))
    const p2Ratio = p2.height / p2.width;
    expect(p2Ratio).toBeGreaterThan(0.65);
    expect(p2Ratio).toBeLessThan(0.75);

    // Page 3: Portrait A4 -> same as p1
    const p3 = measurements[2];
    expect(p3.pageNumber).toBe(3);
    expect(p3.width).toBe(1600);
    expect(p3.height).toBeGreaterThan(1600);
  });
});
