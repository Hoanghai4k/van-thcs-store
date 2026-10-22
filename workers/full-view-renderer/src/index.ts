export {
  DEFAULT_CONFIG,
  type RendererConfig,
} from "./config.js";

export {
  RendererError,
  type RendererErrorCode,
} from "./errors.js";

export {
  SHA256_HEX_REGEX,
  computeSourceSha256,
  validateSha256,
} from "./hash.js";

export {
  DOC_KEY_REGEX,
  PAGE_FILENAME_REGEX,
  createDefaultDocumentManifest,
  formatDocKey,
  formatPageFilename,
  validateRenderArtifacts,
} from "./manifest.js";

export {
  preflightPdfDocument,
  type PdfPreflightResult,
} from "./pdf-preflight.js";

export {
  renderPdf,
} from "./pdf-renderer.js";

export {
  safeSpawn,
  type SafeSpawnOptions,
  type SafeSpawnResult,
} from "./process.js";

export {
  convertDocxToIntermediatePdf,
  type DocxConversionResult,
} from "./docx-adapter.js";

export {
  rejectZipArchive,
} from "./zip-boundary.js";

export {
  UUID_V4_REGEX,
  mapRenderResultToArtifactReadyPayload,
  type MappingOptions,
} from "./migration-mapper.js";

export type {
  DocumentManifestEntry,
  DocumentViewArtifactReadyPayload,
  PageRenderMeasurement,
  RenderMetrics,
  RenderRequest,
  RenderResult,
} from "./types.js";

export * from "./orchestrator/index.js";
