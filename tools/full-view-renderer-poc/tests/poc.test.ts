import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { computeSourceSha256, validateSha256 } from "../src/hash.js";
import {
  formatPageFilename,
  validateArtifactMetadata,
  type FullViewArtifactMetadata,
} from "../src/manifest.js";
import { renderDocument } from "../src/render.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Full View Renderer PoC — Pure Logic Unit Tests", () => {
  const fixturesDir = resolve(__dirname, "../fixtures");
  const samplePdf = resolve(fixturesDir, "sample-vietnamese-lesson.pdf");

  it("computes valid 64-character lowercase hexadecimal SHA-256 strictly from file bytes", async () => {
    const hash = await computeSourceSha256(samplePdf);
    expect(hash).toHaveLength(64);
    expect(validateSha256(hash)).toBe(true);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hash.toLowerCase());
  });

  it("formats deterministic zero-padded 4-digit page filenames", () => {
    expect(formatPageFilename(1)).toBe("page-0001.webp");
    expect(formatPageFilename(25)).toBe("page-0025.webp");
    expect(formatPageFilename(100)).toBe("page-0100.webp");
    expect(formatPageFilename(1234)).toBe("page-1234.webp");
  });

  it("throws error for non-positive or non-integer page numbers", () => {
    expect(() => formatPageFilename(0)).toThrow();
    expect(() => formatPageFilename(-1)).toThrow();
    expect(() => formatPageFilename(1.5)).toThrow();
  });

  it("validates a compliant READY manifest matching Migration 016 invariants", () => {
    const validMeta: FullViewArtifactMetadata = {
      sourceSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      rendererVersion: "webp-poc-v1",
      status: "READY",
      storageProvider: "R2",
      pageCount: 3,
      documentManifest: [
        {
          key: "doc-0001",
          name: "Giáo Án Ngữ Văn",
          pageCount: 3,
        },
      ],
      errorCode: null,
      errorMessage: null,
    };

    const result = validateArtifactMetadata(validMeta);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects READY status with empty documentManifest array", () => {
    const invalidMeta: FullViewArtifactMetadata = {
      sourceSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      rendererVersion: "webp-poc-v1",
      status: "READY",
      storageProvider: "R2",
      pageCount: 3,
      documentManifest: [],
      errorCode: null,
      errorMessage: null,
    };

    const result = validateArtifactMetadata(invalidMeta);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("non-empty document_manifest"))).toBe(true);
  });

  it("rejects READY status when manifest pageCount sum does not match total pageCount", () => {
    const mismatchedMeta: FullViewArtifactMetadata = {
      sourceSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      rendererVersion: "webp-poc-v1",
      status: "READY",
      storageProvider: "R2",
      pageCount: 10,
      documentManifest: [
        { key: "doc-0001", name: "Phần 1", pageCount: 4 },
        { key: "doc-0002", name: "Phần 2", pageCount: 5 }, // sum is 9, expected 10
      ],
      errorCode: null,
      errorMessage: null,
    };

    const result = validateArtifactMetadata(mismatchedMeta);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Sum of sub-document page counts"))).toBe(true);
  });

  it("rejects READY status when error_code or error_message is not null", () => {
    const errorMeta: FullViewArtifactMetadata = {
      sourceSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      rendererVersion: "webp-poc-v1",
      status: "READY",
      storageProvider: "R2",
      pageCount: 3,
      documentManifest: [{ key: "doc-0001", name: "Doc", pageCount: 3 }],
      errorCode: "ERR_RENDER_FAILED",
      errorMessage: "Something broke",
    };

    const result = validateArtifactMetadata(errorMeta);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("error_code to be NULL"))).toBe(true);
  });

  it("rejects empty or whitespace renderer_version", () => {
    const emptyVersionMeta: FullViewArtifactMetadata = {
      sourceSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      rendererVersion: "   ",
      status: "READY",
      storageProvider: "R2",
      pageCount: 1,
      documentManifest: [{ key: "doc-0001", name: "Doc", pageCount: 1 }],
      errorCode: null,
      errorMessage: null,
    };

    const result = validateArtifactMetadata(emptyVersionMeta);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("renderer_version cannot be empty"))).toBe(true);
  });

  it("rejects unsupported file formats gracefully", async () => {
    await expect(renderDocument(resolve(fixturesDir, "nonexistent.xyz"))).rejects.toThrow();
  });
});
