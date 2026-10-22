/**
 * Production Full View Renderer Configuration & Resource Guards.
 *
 * NOTE: These defaults are initial conservative engineering limits for development
 * and worker safety, NOT experimentally benchmarked universal constants.
 */
export interface RendererConfig {
  rendererVersion: string;
  defaultPageWidth: number;
  minPageWidth: number;
  maxPageWidth: number;
  defaultWebpQuality: number;
  minWebpQuality: number;
  maxWebpQuality: number;
  maxSourceBytes: number;
  maxPdfPages: number;
  maxRenderPixelsPerPage: number;
  defaultRenderTimeoutMs: number;
  defaultConcurrency: number;
  maxPageNumber: number;
}

export const DEFAULT_CONFIG: RendererConfig = {
  rendererVersion: "webp-prod-v1",
  defaultPageWidth: 1600,
  minPageWidth: 400,
  maxPageWidth: 4096,
  defaultWebpQuality: 85,
  minWebpQuality: 1,
  maxWebpQuality: 100,
  maxSourceBytes: 100 * 1024 * 1024, // 100 MiB source file guard
  // NOTE: maxPdfPages = 1000 is a hard safety rejection ceiling only.
  // It does NOT imply a 1,000-page document will complete within the default render timeout.
  // Operational limits will likely be lower and must be measured using real educational documents.
  maxPdfPages: 1000,                  // Hard rejection ceiling (1,000 pages max)
  maxRenderPixelsPerPage: 16_000_000, // 16 MegaPixels per page canvas cap
  defaultRenderTimeoutMs: 120_000,    // 2 minutes total timeout
  defaultConcurrency: 2,              // 2 concurrent page renders for strict memory protection
  maxPageNumber: 9999,                // 4-digit zero padded naming boundary
};
