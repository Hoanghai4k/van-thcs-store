import { describe, it, expect, beforeEach } from "vitest";
import { resolve, join } from "node:path";
import {
  DocumentOrchestrator,
  InMemoryArtifactRepository,
  InMemoryDerivedStorage,
  validateObjectKey,
  sanitizeErrorMessage,
  classifyFailure,
  type OrchestrateRenderRequest,
} from "../src/orchestrator/index.js";
import { RendererError } from "../src/errors.js";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");
const STANDARD_PDF = join(FIXTURES_DIR, "standard-lesson-3p.pdf");
const CORRUPT_PDF = join(FIXTURES_DIR, "corrupt-file.pdf");

describe("Phase 2F — Orchestrator Failure Handling & Safety Guards", () => {
  let repository: InMemoryArtifactRepository;
  let storage: InMemoryDerivedStorage;
  let orchestrator: DocumentOrchestrator;

  beforeEach(() => {
    repository = new InMemoryArtifactRepository();
    storage = new InMemoryDerivedStorage();
    orchestrator = new DocumentOrchestrator({
      repository,
      storage,
      localScratchRoot: resolve(__dirname, "../output/orch-failures"),
    });
  });

  it("never marks READY on partial upload failure, transitions to FAILED_RETRYABLE, and cleans up storage", async () => {
    const productFileId = "550e8400-e29b-41d4-a716-446655440010";

    // Inject failure on page 2 upload
    storage.uploadFile = async (key, filePath, contentType) => {
      if (key.includes("page-0002.webp")) {
        throw new Error("Simulated network drop on page 2 upload");
      }
      return InMemoryDerivedStorage.prototype.uploadFile.call(storage, key, filePath, contentType);
    };

    const request: OrchestrateRenderRequest = {
      productFileId,
      sourceFilePath: STANDARD_PDF,
      displayName: "Partial Upload Test",
    };

    await expect(orchestrator.processDocument(request)).rejects.toThrowError(/Simulated network drop/);

    // Verify record state in repository: NEVER READY
    const records = repository.getAllRecords();
    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record.status).toBe("FAILED_RETRYABLE");
    expect(record.error_code).toBe("NETWORK_UPLOAD_ERROR");
    expect(record.error_message).toContain("Simulated network drop");
    expect(record.page_count).toBeNull();

    // Verify cleanup was executed on storage: no orphaned keys left
    expect(storage.getAllKeys()).toHaveLength(0);
  });

  it("ensures storage cleanup failure does NOT mask original render/upload failure", async () => {
    const productFileId = "550e8400-e29b-41d4-a716-446655440011";

    // Inject failure on upload
    storage.uploadFile = async () => {
      throw new Error("Primary upload network crash");
    };

    // Inject failure on cleanup
    storage.deletePrefix = async () => {
      throw new Error("Secondary R2 connection error during cleanup");
    };

    const request: OrchestrateRenderRequest = {
      productFileId,
      sourceFilePath: STANDARD_PDF,
      displayName: "Cleanup Masking Test",
    };

    // Original upload error must be thrown, NOT the cleanup error
    await expect(orchestrator.processDocument(request)).rejects.toThrowError(/Primary upload network crash/);

    // Original error must be stored in repository
    const record = (await repository.getAllRecords())[0];
    expect(record.status).toBe("FAILED_RETRYABLE");
    expect(record.error_message).toContain("Primary upload network crash");
  });

  it("classifies corrupt PDF as FAILED_FINAL and blocks automatic retry", async () => {
    const productFileId = "550e8400-e29b-41d4-a716-446655440012";
    const request: OrchestrateRenderRequest = {
      productFileId,
      sourceFilePath: CORRUPT_PDF,
      displayName: "Corrupt Document",
    };

    await expect(orchestrator.processDocument(request)).rejects.toThrowError(RendererError);

    const record = (await repository.getAllRecords())[0];
    expect(record.status).toBe("FAILED_FINAL");
    expect(record.error_code).toBe("CORRUPT_PDF");

    // Second run without forceRetry must be blocked immediately
    await expect(orchestrator.processDocument(request)).rejects.toThrowError(
      /previously failed with non-retryable error/
    );

    // Second run with forceRetry=true is permitted to retry (will re-attempt and fail cleanly)
    await expect(
      orchestrator.processDocument({ ...request, forceRetry: true })
    ).rejects.toThrowError(RendererError);
  });

  it("classifies render timeout as FAILED_RETRYABLE and permits retry", async () => {
    const productFileId = "550e8400-e29b-41d4-a716-446655440013";
    const request: OrchestrateRenderRequest = {
      productFileId,
      sourceFilePath: STANDARD_PDF,
      displayName: "Timeout Test",
      timeoutMs: 1, // 1ms forces RENDER_TIMEOUT
    };

    await expect(orchestrator.processDocument(request)).rejects.toThrowError(RendererError);

    const record = (await repository.getAllRecords())[0];
    expect(record.status).toBe("FAILED_RETRYABLE");
    expect(record.error_code).toBe("RENDER_TIMEOUT");

    // FAILED_RETRYABLE allows automatic reprocessing on subsequent request
    // Run again with adequate timeout -> succeeds and transitions to READY
    const retryResult = await orchestrator.processDocument({
      productFileId,
      sourceFilePath: STANDARD_PDF,
      displayName: "Timeout Test",
      timeoutMs: 60000,
    });

    expect(retryResult.status).toBe("READY");
    expect(retryResult.pageCount).toBe(3);

    const updatedRecord = (await repository.getAllRecords())[0];
    expect(updatedRecord.status).toBe("READY");
    expect(updatedRecord.error_code).toBeNull();
  });

  it("blocks concurrent processing when artifact is already in PROCESSING state", async () => {
    const productFileId = "550e8400-e29b-41d4-a716-446655440014";

    // Simulate an existing record currently PROCESSING (e.g. from Worker A)
    const pending = await repository.createPending({
      productFileId,
      sourceSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      rendererVersion: "webp-prod-v1",
      storageProvider: "R2",
      storagePrefix: `derived/full-view/${productFileId}/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855/webp-prod-v1/`,
    });
    await repository.markProcessing(pending.id);

    // Worker B attempts to process the exact same version
    const request: OrchestrateRenderRequest = {
      productFileId,
      sourceFilePath: STANDARD_PDF, // Has a specific sha256
      displayName: "Concurrent Worker Test",
      rendererVersion: "webp-prod-v1",
    };

    // Calculate actual sha256 of standard pdf to match
    const { computeSourceSha256 } = await import("../src/hash.js");
    const actualHash = await computeSourceSha256(STANDARD_PDF);

    // Create record matching actual hash
    const matchingPending = await repository.createPending({
      productFileId,
      sourceSha256: actualHash,
      rendererVersion: "webp-prod-v1",
      storageProvider: "R2",
      storagePrefix: `derived/full-view/${productFileId}/${actualHash}/webp-prod-v1/`,
    });
    await repository.markProcessing(matchingPending.id);

    await expect(orchestrator.processDocument(request)).rejects.toThrowError(
      /already PROCESSING/
    );
  });

  it("rejects path traversal and invalid storage keys before upload", () => {
    expect(() => validateObjectKey("/leading-slash/file.webp")).toThrowError(/leading slash/);
    expect(() => validateObjectKey("back\\slash\\file.webp")).toThrowError(/backslashes/);
    expect(() => validateObjectKey("path/../traversal/file.webp")).toThrowError(/traversal/);
    expect(() => validateObjectKey("empty//segment/file.webp")).toThrowError(/empty path segment/);
  });

  it("sanitizes sensitive data and truncates long error messages", () => {
    const rawError =
      "Failed to put object at https://r2.cloudflarestorage.com/bucket/doc.webp?X-Amz-Signature=secret123&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE using Bearer eyJhbGciOiJIUzI1NiJ9.secretToken and token: secret456";

    const sanitized = sanitizeErrorMessage(rawError);
    expect(sanitized).not.toContain("secret123");
    expect(sanitized).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(sanitized).toContain("[REDACTED_PRESIGNED_URL]");
    expect(sanitized).toContain("Bearer [REDACTED_TOKEN]");

    // Truncation check
    const longString = "A".repeat(1000);
    const truncated = sanitizeErrorMessage(longString, 50);
    expect(truncated.length).toBe(50);
    expect(truncated.endsWith("...")).toBe(true);
  });

  it("rejects ZIP archives immediately with UNSUPPORTED_FORMAT", async () => {
    const request: OrchestrateRenderRequest = {
      productFileId: "dummy-id",
      sourceFilePath: "sample-archive.zip",
      displayName: "Archive",
    };

    await expect(orchestrator.processDocument(request)).rejects.toThrowError(/ZIP archive extraction is not supported/);
  });
});
