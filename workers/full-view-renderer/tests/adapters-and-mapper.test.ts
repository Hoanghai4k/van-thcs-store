import { describe, it, expect } from "vitest";
import {
  mapRenderResultToArtifactReadyPayload,
  type MappingOptions,
} from "../src/migration-mapper.js";
import { formatPageFilename } from "../src/manifest.js";
import { convertDocxToIntermediatePdf } from "../src/docx-adapter.js";
import { rejectZipArchive } from "../src/zip-boundary.js";
import { RendererError } from "../src/errors.js";
import type { RenderResult } from "../src/types.js";

describe("Phase 2E — Adapters & Migration 016 Mapper", () => {
  const sampleRenderResult: RenderResult = {
    sourceSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    rendererVersion: "webp-prod-v1",
    status: "READY",
    pageCount: 3,
    documentManifest: [
      {
        key: "doc-0001",
        name: "Bai giang Van hoc 9",
        pageCount: 3,
      },
    ],
    localOutputDirectory: "/tmp/fake-dir",
    manifestFilePath: "/tmp/fake-dir/manifest.json",
    metrics: {
      totalDurationMs: 1200,
      sourceSizeBytes: 50000,
      totalWebpSizeBytes: 200000,
      meanPageSizeBytes: 66666,
      minPageSizeBytes: 60000,
      maxPageSizeBytes: 70000,
      pageMeasurements: [],
    },
  };

  describe("Migration 016 Mapper", () => {
    it("successfully maps valid RenderResult to DocumentViewArtifactReadyPayload", () => {
      const payload = mapRenderResultToArtifactReadyPayload(sampleRenderResult, {
        productFileId: "550e8400-e29b-41d4-a716-446655440000",
        storageProvider: "R2",
        storagePrefixTemplate: "derived/full-view/{fileId}/{hash}/{version}/",
      });

      expect(payload).toEqual({
        product_file_id: "550e8400-e29b-41d4-a716-446655440000",
        source_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        renderer_version: "webp-prod-v1",
        status: "READY",
        storage_provider: "R2",
        storage_prefix: "derived/full-view/550e8400-e29b-41d4-a716-446655440000/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855/webp-prod-v1/",
        page_count: 3,
        document_manifest: [
          {
            key: "doc-0001",
            name: "Bai giang Van hoc 9",
            pageCount: 3,
          },
        ],
        error_code: null,
        error_message: null,
      });
    });

    it("rejects invalid or uppercase SHA-256", () => {
      const invalidHashResult: RenderResult = {
        ...sampleRenderResult,
        sourceSha256: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855", // uppercase
      };

      expect(() =>
        mapRenderResultToArtifactReadyPayload(invalidHashResult, {
          productFileId: "dummy-id",
        })
      ).toThrowError(/source_sha256/);
    });

    it("rejects empty productFileId", () => {
      expect(() =>
        mapRenderResultToArtifactReadyPayload(sampleRenderResult, {
          productFileId: "   ",
        })
      ).toThrowError(/productFileId/);
    });

    it("rejects manifest page count mismatch", () => {
      const mismatchedResult: RenderResult = {
        ...sampleRenderResult,
        pageCount: 10, // top-level 10 vs manifest 3
      };

      expect(() =>
        mapRenderResultToArtifactReadyPayload(mismatchedResult, {
          productFileId: "dummy-id",
        })
      ).toThrowError(/manifest pageCount sum/);
    });
  });

  describe("Page Naming Boundary (> 9999 pages)", () => {
    it("formats 1-based page up to 9999 with 4 digits", () => {
      expect(formatPageFilename(1)).toBe("page-0001.webp");
      expect(formatPageFilename(42)).toBe("page-0042.webp");
      expect(formatPageFilename(9999)).toBe("page-9999.webp");
    });

    it("throws PAGE_COUNT_EXCEEDS_NAMING_LIMIT if page exceeds 9999", () => {
      expect(() => formatPageFilename(10000)).toThrowError(RendererError);
      try {
        formatPageFilename(10000);
      } catch (err: any) {
        expect(err.code).toBe("PAGE_COUNT_EXCEEDS_NAMING_LIMIT");
      }
    });

    it("throws VALIDATION_FAILURE if page is less than 1", () => {
      expect(() => formatPageFilename(0)).toThrowError(RendererError);
    });
  });

  describe("DOCX Adapter & Runtime Boundary", () => {
    it("throws DOCX_RUNTIME_UNAVAILABLE gracefully when LibreOffice is not installed", async () => {
      // In current Windows dev environment, LibreOffice is not installed
      try {
        await convertDocxToIntermediatePdf("sample.docx", "/tmp");
        expect.fail("Should have thrown DOCX_RUNTIME_UNAVAILABLE");
      } catch (err: any) {
        expect(err).toBeInstanceOf(RendererError);
        expect(err.code).toBe("DOCX_RUNTIME_UNAVAILABLE");
        expect(err.message).toContain("LibreOffice/soffice is not installed");
      }
    });
  });

  describe("ZIP Archive Boundary", () => {
    it("rejects ZIP archives with UNSUPPORTED_FORMAT", () => {
      expect(() => rejectZipArchive("sample.zip")).toThrowError(RendererError);
      try {
        rejectZipArchive("sample.zip");
      } catch (err: any) {
        expect(err.code).toBe("UNSUPPORTED_FORMAT");
        expect(err.message).toContain("ZIP archive extraction is not supported");
      }
    });
  });
});
