import { RendererError } from "./errors.js";

/**
 * Future ZIP Archive Boundary.
 *
 * In accordance with Phase 2E specifications:
 * ZIP archive unpacking/extraction is NOT implemented in this phase.
 * In a future phase, a dedicated archive extraction orchestrator will unpack
 * archives into discrete DOCX/PDF components before invoking the renderer worker.
 */
export function rejectZipArchive(inputPath: string): never {
  throw new RendererError(
    "UNSUPPORTED_FORMAT",
    `ZIP archive extraction is not supported in the renderer foundation. Received: ${inputPath}. Multi-file archive extraction belongs to a separate pre-ingestion orchestrator.`
  );
}
