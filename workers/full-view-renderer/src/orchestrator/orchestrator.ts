import { extname, resolve } from "node:path";
import { DEFAULT_CONFIG } from "../config.js";
import { RendererError } from "../errors.js";
import { computeSourceSha256 } from "../hash.js";
import { renderPdf } from "../pdf-renderer.js";
import type { RenderRequest, RenderResult } from "../types.js";
import { rejectZipArchive } from "../zip-boundary.js";
import type { ArtifactRepository } from "./artifact-repository.js";
import { cleanupFailedStoragePrefix } from "./cleanup.js";
import type { DerivedStorage } from "./derived-storage.js";
import { classifyFailure } from "./failure-classifier.js";
import { buildStoragePrefix, planDerivedObjects } from "./object-plan.js";
import type {
  DocumentViewArtifactRecord,
  OrchestrateRenderRequest,
  OrchestrateRenderResult,
  StorageProvider,
} from "./types.js";

export type DocumentRendererFn = (req: RenderRequest) => Promise<RenderResult>;

export interface OrchestratorOptions {
  repository: ArtifactRepository;
  storage: DerivedStorage;
  renderer?: DocumentRendererFn;
  localScratchRoot?: string;
  storageProvider?: StorageProvider;
}

/**
 * Production Document View Orchestrator.
 *
 * Responsibilities:
 * 1. Source hash verification (byte-level SHA-256).
 * 2. Artifact lifecycle management (PENDING -> PROCESSING -> READY).
 * 3. Idempotency (skip existing READY, guard against concurrent processing, allow controlled retry).
 * 4. Local rendering via isolated renderer worker.
 * 5. Deterministic storage object planning and uploading.
 * 6. Strict upload verification (markReady ONLY after all objects verified).
 * 7. Failure classification (FAILED_RETRYABLE vs FAILED_FINAL).
 * 8. Cleanup of partially uploaded storage objects upon failure.
 */
export class DocumentOrchestrator {
  private repository: ArtifactRepository;
  private storage: DerivedStorage;
  private renderer: DocumentRendererFn;
  private localScratchRoot: string;
  private storageProvider: StorageProvider;

  constructor(options: OrchestratorOptions) {
    this.repository = options.repository;
    this.storage = options.storage;
    this.renderer = options.renderer ?? renderPdf;
    this.localScratchRoot = options.localScratchRoot ?? resolve(process.cwd(), "output/orchestrator");
    this.storageProvider = options.storageProvider ?? "R2";
  }

  async processDocument(request: OrchestrateRenderRequest): Promise<OrchestrateRenderResult> {
    const {
      productFileId,
      sourceFilePath,
      displayName,
      rendererVersion = DEFAULT_CONFIG.rendererVersion,
      pageWidth,
      webpQuality,
      forceRetry = false,
      dryRun = false,
      timeoutMs,
    } = request;

    // 0. Boundary checks
    const ext = extname(sourceFilePath).toLowerCase();
    if (ext === ".zip") {
      rejectZipArchive(sourceFilePath);
    }

    // 1. Authoritative byte-level SHA-256 computation
    const sourceSha256 = await computeSourceSha256(sourceFilePath);
    const storagePrefix = buildStoragePrefix(productFileId, sourceSha256, rendererVersion);

    // 2. Query existing artifact state
    let record: DocumentViewArtifactRecord | null = null;
    if (!dryRun) {
      record = await this.repository.findVersion(productFileId, sourceSha256, rendererVersion);
    }

    // 3. Idempotency & State Machine Guards
    if (record) {
      if (record.status === "READY") {
        return {
          artifactId: record.id,
          productFileId,
          sourceSha256,
          rendererVersion,
          status: "READY",
          storagePrefix: record.storage_prefix,
          pageCount: record.page_count ?? 0,
          uploadedObjectsCount: record.page_count ?? 0,
          skippedBecauseAlreadyReady: true,
          dryRun,
        };
      }

      if (record.status === "PROCESSING") {
        throw new RendererError(
          "RENDER_FAILURE",
          `Artifact for productFileId='${productFileId}', sha256='${sourceSha256}', version='${rendererVersion}' is already PROCESSING.`
        );
      }

      if (record.status === "FAILED_FINAL" && !forceRetry) {
        throw new RendererError(
          "RENDER_FAILURE",
          `Artifact previously failed with non-retryable error [${record.error_code}]: ${record.error_message}. Set forceRetry=true to reprocess.`
        );
      }
    }

    // 4. Create PENDING record if new
    if (!dryRun && !record) {
      record = await this.repository.createPending({
        productFileId,
        sourceSha256,
        rendererVersion,
        storageProvider: this.storageProvider,
        storagePrefix,
      });
    }

    const artifactId = record?.id ?? "dry-run-artifact-id";

    // 5. Transition to PROCESSING
    if (!dryRun && record) {
      record = await this.repository.markProcessing(record.id);
    }

    let renderResult: RenderResult | undefined;

    try {
      // 6. Invoke Document Renderer
      renderResult = await this.renderer({
        inputPath: sourceFilePath,
        displayName,
        outputRoot: this.localScratchRoot,
        rendererVersion,
        pageWidth,
        webpQuality,
        timeoutMs,
      });

      // 7. Plan derived storage objects
      const objectPlan = planDerivedObjects({
        productFileId,
        sourceSha256: renderResult.sourceSha256,
        rendererVersion: renderResult.rendererVersion,
        documentManifest: renderResult.documentManifest,
        localOutputDirectory: renderResult.localOutputDirectory,
      });

      let uploadedCount = 0;

      // 8. Upload objects to storage (skipped in dry-run mode)
      if (!dryRun) {
        // Upload each page WebP image
        for (const item of objectPlan.objects) {
          await this.storage.uploadFile(item.objectKey, item.localFilePath, "image/webp");
          uploadedCount++;
        }

        // Upload manifest.json
        await this.storage.uploadFile(
          objectPlan.manifestObjectKey,
          renderResult.manifestFilePath,
          "application/json"
        );

        // 9. Strict Upload Verification: verify every expected object exists before markReady
        for (const item of objectPlan.objects) {
          const exists = await this.storage.objectExists(item.objectKey);
          if (!exists) {
            throw new RendererError(
              "STORAGE_VERIFICATION_FAILED",
              `Upload verification failed: missing object in storage: '${item.objectKey}'`
            );
          }
        }

        const manifestExists = await this.storage.objectExists(objectPlan.manifestObjectKey);
        if (!manifestExists) {
          throw new RendererError(
            "STORAGE_VERIFICATION_FAILED",
            `Upload verification failed: missing manifest in storage: '${objectPlan.manifestObjectKey}'`
          );
        }

        // 10. Strict READY Transition (ONLY called after complete verification)
        record = await this.repository.markReady(artifactId, {
          pageCount: renderResult.pageCount,
          documentManifest: renderResult.documentManifest,
          storagePrefix: objectPlan.storagePrefix,
        });
      } else {
        uploadedCount = objectPlan.objects.length;
      }

      return {
        artifactId,
        productFileId,
        sourceSha256,
        rendererVersion,
        status: "READY",
        storagePrefix: objectPlan.storagePrefix,
        pageCount: renderResult.pageCount,
        uploadedObjectsCount: uploadedCount,
        skippedBecauseAlreadyReady: false,
        dryRun,
        renderResult,
      };
    } catch (err) {
      // 11. Failure Handling & Classification
      const classification = classifyFailure(err);

      // Attempt cleanup of orphaned/partial uploads
      let cleanupAttempted = false;
      if (!dryRun) {
        cleanupAttempted = true;
        await cleanupFailedStoragePrefix(this.storage, storagePrefix);
      }

      // Record failure in repository
      if (!dryRun && record) {
        try {
          await this.repository.markFailure(record.id, {
            status: classification.status,
            errorCode: classification.errorCode,
            errorMessage: classification.errorMessage,
          });
        } catch {
          // Prevent DB failure from masking primary render/upload error
        }
      }

      throw err;
    }
  }
}
