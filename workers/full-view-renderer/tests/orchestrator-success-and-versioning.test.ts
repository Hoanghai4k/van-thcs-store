import { describe, it, expect, beforeEach } from "vitest";
import { resolve, join } from "node:path";
import {
  DocumentOrchestrator,
  InMemoryArtifactRepository,
  InMemoryDerivedStorage,
  buildStoragePrefix,
  planDerivedObjects,
  type OrchestrateRenderRequest,
} from "../src/orchestrator/index.js";
import { SHA256_HEX_REGEX } from "../src/hash.js";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");
const STANDARD_PDF = join(FIXTURES_DIR, "standard-lesson-3p.pdf");
const MIXED_PDF = join(FIXTURES_DIR, "mixed-geometry-3p.pdf");

describe("Phase 2F — Orchestrator Success & Versioning", () => {
  let repository: InMemoryArtifactRepository;
  let storage: InMemoryDerivedStorage;
  let orchestrator: DocumentOrchestrator;

  beforeEach(() => {
    repository = new InMemoryArtifactRepository();
    storage = new InMemoryDerivedStorage();
    orchestrator = new DocumentOrchestrator({
      repository,
      storage,
      localScratchRoot: resolve(__dirname, "../output/orch-success"),
    });
  });

  it("completes full lifecycle: PENDING -> PROCESSING -> READY for new artifact", async () => {
    const productFileId = "550e8400-e29b-41d4-a716-446655440001";
    const request: OrchestrateRenderRequest = {
      productFileId,
      sourceFilePath: STANDARD_PDF,
      displayName: "Giao An Ngu Van THCS",
      rendererVersion: "webp-prod-v1",
    };

    const result = await orchestrator.processDocument(request);

    // 1. Result assertions
    expect(result.status).toBe("READY");
    expect(result.pageCount).toBe(3);
    expect(result.uploadedObjectsCount).toBe(3);
    expect(result.skippedBecauseAlreadyReady).toBe(false);
    expect(result.sourceSha256).toMatch(SHA256_HEX_REGEX);

    const expectedPrefix = `derived/full-view/${productFileId}/${result.sourceSha256}/webp-prod-v1/`;
    expect(result.storagePrefix).toBe(expectedPrefix);

    // 2. Storage assertions: 3 WebP pages + 1 manifest.json uploaded
    const storedKeys = storage.getAllKeys();
    expect(storedKeys).toHaveLength(4);
    expect(storedKeys).toContain(`${expectedPrefix}doc-0001/page-0001.webp`);
    expect(storedKeys).toContain(`${expectedPrefix}doc-0001/page-0002.webp`);
    expect(storedKeys).toContain(`${expectedPrefix}doc-0001/page-0003.webp`);
    expect(storedKeys).toContain(`${expectedPrefix}manifest.json`);

    // Verify stored content
    const page1 = storage.getObject(`${expectedPrefix}doc-0001/page-0001.webp`);
    expect(page1).toBeDefined();
    expect(page1!.contentType).toBe("image/webp");
    expect(page1!.bytes.length).toBeGreaterThan(1000);

    const manifestObj = storage.getObject(`${expectedPrefix}manifest.json`);
    expect(manifestObj).toBeDefined();
    expect(manifestObj!.contentType).toBe("application/json");

    // 3. Repository state check: status must be READY, error fields null
    const record = await repository.findVersion(productFileId, result.sourceSha256, "webp-prod-v1");
    expect(record).not.toBeNull();
    expect(record!.status).toBe("READY");
    expect(record!.page_count).toBe(3);
    expect(record!.document_manifest).toHaveLength(1);
    expect(record!.error_code).toBeNull();
    expect(record!.error_message).toBeNull();
  });

  it("idempotently skips an existing READY version without re-rendering or uploading", async () => {
    const productFileId = "550e8400-e29b-41d4-a716-446655440002";
    const request: OrchestrateRenderRequest = {
      productFileId,
      sourceFilePath: STANDARD_PDF,
      displayName: "Giao An Ngu Van THCS",
      rendererVersion: "webp-prod-v1",
    };

    // First run -> creates READY
    const firstResult = await orchestrator.processDocument(request);
    expect(firstResult.status).toBe("READY");
    expect(firstResult.skippedBecauseAlreadyReady).toBe(false);

    const initialUploadCount = storage.getAllKeys().length;
    expect(initialUploadCount).toBe(4);

    // Second run -> must skip
    const secondResult = await orchestrator.processDocument(request);
    expect(secondResult.status).toBe("READY");
    expect(secondResult.skippedBecauseAlreadyReady).toBe(true);
    expect(secondResult.artifactId).toBe(firstResult.artifactId);

    // Assert no additional uploads occurred
    expect(storage.getAllKeys().length).toBe(initialUploadCount);
  });

  it("plans objects correctly for multi-document manifests and checks deterministic prefix", () => {
    const productFileId = "550e8400-e29b-41d4-a716-446655440003";
    const hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const version = "webp-prod-v1";

    const plan = planDerivedObjects({
      productFileId,
      sourceSha256: hash,
      rendererVersion: version,
      documentManifest: [
        { key: "doc-0001", name: "Phan 1 - Ly thuyet", pageCount: 2 },
        { key: "doc-0002", name: "Phan 2 - Bai tap", pageCount: 3 },
      ],
      localOutputDirectory: "/tmp/fake-output",
    });

    expect(plan.storagePrefix).toBe(`derived/full-view/${productFileId}/${hash}/${version}/`);
    expect(plan.objects).toHaveLength(5);
    expect(plan.totalExpectedPages).toBe(5);

    // Verify document 1 keys
    expect(plan.objects[0].objectKey).toBe(`derived/full-view/${productFileId}/${hash}/${version}/doc-0001/page-0001.webp`);
    expect(plan.objects[1].objectKey).toBe(`derived/full-view/${productFileId}/${hash}/${version}/doc-0001/page-0002.webp`);

    // Verify document 2 keys
    expect(plan.objects[2].objectKey).toBe(`derived/full-view/${productFileId}/${hash}/${version}/doc-0002/page-0001.webp`);
    expect(plan.objects[3].objectKey).toBe(`derived/full-view/${productFileId}/${hash}/${version}/doc-0002/page-0002.webp`);
    expect(plan.objects[4].objectKey).toBe(`derived/full-view/${productFileId}/${hash}/${version}/doc-0002/page-0003.webp`);

    expect(plan.manifestObjectKey).toBe(`derived/full-view/${productFileId}/${hash}/${version}/manifest.json`);
  });

  it("supports dryRun mode: simulates planning without mutating repository or storage", async () => {
    const productFileId = "550e8400-e29b-41d4-a716-446655440004";
    const request: OrchestrateRenderRequest = {
      productFileId,
      sourceFilePath: STANDARD_PDF,
      displayName: "Dry Run Test",
      dryRun: true,
    };

    const result = await orchestrator.processDocument(request);

    expect(result.dryRun).toBe(true);
    expect(result.status).toBe("READY");
    expect(result.pageCount).toBe(3);

    // Verify storage is completely empty
    expect(storage.getAllKeys()).toHaveLength(0);

    // Verify repository is completely empty
    expect(repository.getAllRecords()).toHaveLength(0);
  });

  it("handles source replacement: creates new version for new source hash while preserving old version", async () => {
    const productFileId = "550e8400-e29b-41d4-a716-446655440005";

    // 1. Initial source A (standard 3-page)
    const resultA = await orchestrator.processDocument({
      productFileId,
      sourceFilePath: STANDARD_PDF,
      displayName: "Version A",
      rendererVersion: "webp-prod-v1",
    });
    expect(resultA.status).toBe("READY");

    // 2. Admin replaces source file with source B (mixed-geometry 3-page, different bytes/hash)
    const resultB = await orchestrator.processDocument({
      productFileId,
      sourceFilePath: MIXED_PDF,
      displayName: "Version B",
      rendererVersion: "webp-prod-v1",
    });
    expect(resultB.status).toBe("READY");
    expect(resultB.sourceSha256).not.toBe(resultA.sourceSha256);

    // 3. Both versions coexist in repository under separate UNIQUE keys
    const records = repository.getAllRecords();
    expect(records).toHaveLength(2);

    const recordA = await repository.findVersion(productFileId, resultA.sourceSha256, "webp-prod-v1");
    const recordB = await repository.findVersion(productFileId, resultB.sourceSha256, "webp-prod-v1");

    expect(recordA).not.toBeNull();
    expect(recordA!.status).toBe("READY");
    expect(recordB).not.toBeNull();
    expect(recordB!.status).toBe("READY");
  });

  it("handles renderer version upgrade: same source with new rendererVersion coexists cleanly", async () => {
    const productFileId = "550e8400-e29b-41d4-a716-446655440006";

    // Version 1
    const resultV1 = await orchestrator.processDocument({
      productFileId,
      sourceFilePath: STANDARD_PDF,
      displayName: "Doc",
      rendererVersion: "webp-prod-v1",
    });

    // Version 2 upgrade
    const resultV2 = await orchestrator.processDocument({
      productFileId,
      sourceFilePath: STANDARD_PDF,
      displayName: "Doc",
      rendererVersion: "webp-prod-v2",
    });

    expect(resultV1.sourceSha256).toBe(resultV2.sourceSha256);
    expect(resultV1.rendererVersion).toBe("webp-prod-v1");
    expect(resultV2.rendererVersion).toBe("webp-prod-v2");

    // Both records exist as READY
    const record1 = await repository.findVersion(productFileId, resultV1.sourceSha256, "webp-prod-v1");
    const record2 = await repository.findVersion(productFileId, resultV2.sourceSha256, "webp-prod-v2");

    expect(record1!.status).toBe("READY");
    expect(record2!.status).toBe("READY");
    expect(record1!.id).not.toBe(record2!.id);
  });
});
