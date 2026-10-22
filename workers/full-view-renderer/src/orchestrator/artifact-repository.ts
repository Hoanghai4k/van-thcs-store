import { randomUUID } from "node:crypto";
import { RendererError } from "../errors.js";
import type { DocumentManifestEntry } from "../types.js";
import type {
  ArtifactStatus,
  DocumentViewArtifactRecord,
  StorageProvider,
} from "./types.js";

/**
 * Repository interface for managing document_view_artifacts lifecycle.
 * Mirrors the PostgreSQL table schema and constraints created in Migration 016.
 */
export interface ArtifactRepository {
  findVersion(
    productFileId: string,
    sourceSha256: string,
    rendererVersion: string
  ): Promise<DocumentViewArtifactRecord | null>;

  createPending(params: {
    productFileId: string;
    sourceSha256: string;
    rendererVersion: string;
    storageProvider: StorageProvider;
    storagePrefix: string;
  }): Promise<DocumentViewArtifactRecord>;

  markProcessing(id: string): Promise<DocumentViewArtifactRecord>;

  markReady(
    id: string,
    params: {
      pageCount: number;
      documentManifest: DocumentManifestEntry[];
      storagePrefix: string;
    }
  ): Promise<DocumentViewArtifactRecord>;

  markFailure(
    id: string,
    params: {
      status: "FAILED_RETRYABLE" | "FAILED_FINAL";
      errorCode: string;
      errorMessage: string;
    }
  ): Promise<DocumentViewArtifactRecord>;
}

/**
 * In-Memory Artifact Repository for testing without database dependencies.
 * Enforces Migration 016 UNIQUE(product_file_id, source_sha256, renderer_version) semantics.
 */
export class InMemoryArtifactRepository implements ArtifactRepository {
  private records = new Map<string, DocumentViewArtifactRecord>();

  private buildKey(productFileId: string, sourceSha256: string, rendererVersion: string): string {
    return `${productFileId}:${sourceSha256.toLowerCase()}:${rendererVersion.trim()}`;
  }

  async findVersion(
    productFileId: string,
    sourceSha256: string,
    rendererVersion: string
  ): Promise<DocumentViewArtifactRecord | null> {
    const key = this.buildKey(productFileId, sourceSha256, rendererVersion);
    const record = this.records.get(key);
    return record ? { ...record } : null;
  }

  async createPending(params: {
    productFileId: string;
    sourceSha256: string;
    rendererVersion: string;
    storageProvider: StorageProvider;
    storagePrefix: string;
  }): Promise<DocumentViewArtifactRecord> {
    const key = this.buildKey(params.productFileId, params.sourceSha256, params.rendererVersion);
    const existing = this.records.get(key);

    if (existing) {
      return { ...existing };
    }

    const now = new Date().toISOString();
    const newRecord: DocumentViewArtifactRecord = {
      id: randomUUID(),
      product_file_id: params.productFileId,
      source_sha256: params.sourceSha256.toLowerCase(),
      renderer_version: params.rendererVersion,
      status: "PENDING",
      storage_provider: params.storageProvider,
      storage_prefix: params.storagePrefix,
      page_count: null,
      document_manifest: [],
      error_code: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    this.records.set(key, newRecord);
    return { ...newRecord };
  }

  async markProcessing(id: string): Promise<DocumentViewArtifactRecord> {
    const record = this.findRecordById(id);
    record.status = "PROCESSING";
    record.error_code = null;
    record.error_message = null;
    record.updated_at = new Date().toISOString();
    return { ...record };
  }

  async markReady(
    id: string,
    params: {
      pageCount: number;
      documentManifest: DocumentManifestEntry[];
      storagePrefix: string;
    }
  ): Promise<DocumentViewArtifactRecord> {
    const record = this.findRecordById(id);

    if (params.pageCount < 1) {
      throw new RendererError("VALIDATION_FAILURE", "Cannot mark ready with pageCount < 1");
    }
    if (!Array.isArray(params.documentManifest) || params.documentManifest.length === 0) {
      throw new RendererError("VALIDATION_FAILURE", "Cannot mark ready with empty documentManifest");
    }

    record.status = "READY";
    record.page_count = params.pageCount;
    record.document_manifest = params.documentManifest;
    record.storage_prefix = params.storagePrefix;
    record.error_code = null;
    record.error_message = null;
    record.updated_at = new Date().toISOString();

    return { ...record };
  }

  async markFailure(
    id: string,
    params: {
      status: "FAILED_RETRYABLE" | "FAILED_FINAL";
      errorCode: string;
      errorMessage: string;
    }
  ): Promise<DocumentViewArtifactRecord> {
    const record = this.findRecordById(id);
    record.status = params.status;
    record.error_code = params.errorCode;
    record.error_message = params.errorMessage;
    record.updated_at = new Date().toISOString();
    return { ...record };
  }

  private findRecordById(id: string): DocumentViewArtifactRecord {
    for (const record of this.records.values()) {
      if (record.id === id) {
        return record;
      }
    }
    throw new RendererError("VALIDATION_FAILURE", `Artifact record with id '${id}' not found`);
  }

  // Testing helpers
  getAllRecords(): DocumentViewArtifactRecord[] {
    return Array.from(this.records.values()).map((r) => ({ ...r }));
  }

  clear(): void {
    this.records.clear();
  }
}

