import type { RendererConfig } from "./config.js";

export interface DocumentManifestEntry {
  key: string;
  name: string;
  pageCount: number;
}

export interface RenderRequest {
  inputPath: string;
  displayName: string;
  outputRoot: string;
  rendererVersion?: string;
  pageWidth?: number;
  webpQuality?: number;
  concurrency?: number;
  timeoutMs?: number;
  configOverrides?: Partial<RendererConfig>;
}

export interface PageRenderMeasurement {
  pageNumber: number;
  filename: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  durationMs: number;
}

export interface RenderMetrics {
  totalDurationMs: number;
  sourceSizeBytes: number;
  totalWebpSizeBytes: number;
  meanPageSizeBytes: number;
  minPageSizeBytes: number;
  maxPageSizeBytes: number;
  peakMemoryBytes?: number;
  pageMeasurements: PageRenderMeasurement[];
}

export interface RenderResult {
  sourceSha256: string;
  rendererVersion: string;
  status: "READY";
  pageCount: number;
  documentManifest: DocumentManifestEntry[];
  localOutputDirectory: string;
  manifestFilePath: string;
  metrics: RenderMetrics;
}

/**
 * Migration 016 Compatible Payload:
 * Pure data object ready for insertion into public.document_view_artifacts
 * once uploaded to remote storage by a separate orchestrator.
 */
export interface DocumentViewArtifactReadyPayload {
  product_file_id: string;
  source_sha256: string;
  renderer_version: string;
  status: "READY";
  storage_provider: "R2" | "SUPABASE";
  storage_prefix: string;
  page_count: number;
  document_manifest: DocumentManifestEntry[];
  error_code: null;
  error_message: null;
}
