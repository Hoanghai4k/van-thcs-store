import type { DocumentManifestEntry, RenderResult } from "../types.js";

export type ArtifactStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY"
  | "FAILED_RETRYABLE"
  | "FAILED_FINAL";

export type StorageProvider = "R2" | "SUPABASE";

/**
 * Mirror of public.document_view_artifacts row structure in Supabase.
 */
export interface DocumentViewArtifactRecord {
  id: string;
  product_file_id: string;
  source_sha256: string;
  renderer_version: string;
  status: ArtifactStatus;
  storage_provider: StorageProvider;
  storage_prefix: string;
  page_count: number | null;
  document_manifest: DocumentManifestEntry[];
  error_code: string | null;
  error_message: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DerivedObjectItem {
  /** POSIX-style key, e.g. "derived/full-view/{fileId}/{hash}/{version}/doc-0001/page-0001.webp" */
  objectKey: string;
  /** Absolute local file path on disk */
  localFilePath: string;
  /** Logical document folder, e.g. "doc-0001" */
  docKey: string;
  /** 1-based page number */
  pageNumber: number;
}

export interface DerivedObjectPlan {
  productFileId: string;
  sourceSha256: string;
  rendererVersion: string;
  storagePrefix: string;
  objects: DerivedObjectItem[];
  manifestObjectKey: string;
  totalExpectedPages: number;
}

export interface OrchestrateRenderRequest {
  productFileId: string;
  sourceFilePath: string;
  displayName: string;
  rendererVersion?: string;
  pageWidth?: number;
  webpQuality?: number;
  forceRetry?: boolean; // Force processing even if previously FAILED_FINAL
  dryRun?: boolean;     // Simulates orchestration without mutating storage or DB
  timeoutMs?: number;
}

export interface OrchestrateRenderResult {
  artifactId: string;
  productFileId: string;
  sourceSha256: string;
  rendererVersion: string;
  status: ArtifactStatus;
  storagePrefix: string;
  pageCount: number;
  uploadedObjectsCount: number;
  skippedBecauseAlreadyReady: boolean;
  dryRun: boolean;
  renderResult?: RenderResult;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
