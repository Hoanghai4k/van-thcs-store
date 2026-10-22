import { RendererError } from "./errors.js";
import { validateSha256 } from "./hash.js";
import type { DocumentViewArtifactReadyPayload, RenderResult } from "./types.js";

export interface MappingOptions {
  productFileId: string;
  storageProvider?: "R2" | "SUPABASE";
  storagePrefixTemplate?: string; // e.g. "derived/full-view/{fileId}/{hash}/{version}/"
}

export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Pure mapping helper that converts an in-memory RenderResult into a
 * Migration 016 compatible DocumentViewArtifactReadyPayload.
 *
 * NOTE:
 * - Does NOT perform any database calls or Supabase writes.
 * - Does NOT interact with R2 or storage APIs.
 * - Verifies all database CHECK constraints and table invariants locally.
 */
export function mapRenderResultToArtifactReadyPayload(
  result: RenderResult,
  options: MappingOptions
): DocumentViewArtifactReadyPayload {
  const { productFileId, storageProvider = "R2", storagePrefixTemplate } = options;

  // 1. Validate product_file_id is non-empty (and UUID formatted if applicable)
  if (!productFileId || typeof productFileId !== "string" || productFileId.trim().length === 0) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      "Mapping failed: productFileId must be a non-empty string"
    );
  }

  // 2. Validate status invariant
  if (result.status !== "READY") {
    throw new RendererError(
      "VALIDATION_FAILURE",
      `Mapping failed: RenderResult status must be 'READY', received '${result.status}'`
    );
  }

  // 3. Validate source SHA-256 (matches ^[0-9a-f]{64}$)
  if (!validateSha256(result.sourceSha256)) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      `Mapping failed: source_sha256 '${result.sourceSha256}' must match ^[0-9a-f]{64}$`
    );
  }

  // 4. Validate renderer_version (btrim(renderer_version) <> '')
  if (
    !result.rendererVersion ||
    typeof result.rendererVersion !== "string" ||
    result.rendererVersion.trim().length === 0
  ) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      "Mapping failed: renderer_version must be a non-empty trimmed string"
    );
  }

  // 5. Validate page_count >= 1
  if (!Number.isInteger(result.pageCount) || result.pageCount < 1) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      `Mapping failed: page_count must be an integer >= 1, received: ${result.pageCount}`
    );
  }

  // 6. Validate document_manifest
  if (!Array.isArray(result.documentManifest) || result.documentManifest.length === 0) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      "Mapping failed: document_manifest must be a non-empty array"
    );
  }

  let totalPages = 0;
  for (const entry of result.documentManifest) {
    if (!entry.key || !entry.name || typeof entry.pageCount !== "number" || entry.pageCount < 1) {
      throw new RendererError(
        "VALIDATION_FAILURE",
        `Mapping failed: invalid document_manifest entry: ${JSON.stringify(entry)}`
      );
    }
    totalPages += entry.pageCount;
  }

  if (totalPages !== result.pageCount) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      `Mapping failed: manifest pageCount sum (${totalPages}) does not equal top-level page_count (${result.pageCount})`
    );
  }

  // 7. Resolve storage prefix
  const template = storagePrefixTemplate ?? "derived/full-view/{fileId}/{hash}/{version}/";
  const storagePrefix = template
    .replace("{fileId}", productFileId)
    .replace("{hash}", result.sourceSha256)
    .replace("{version}", result.rendererVersion);

  if (storagePrefix.trim().length === 0) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      "Mapping failed: storage_prefix must be non-empty"
    );
  }

  return {
    product_file_id: productFileId,
    source_sha256: result.sourceSha256,
    renderer_version: result.rendererVersion,
    status: "READY",
    storage_provider: storageProvider,
    storage_prefix: storagePrefix,
    page_count: result.pageCount,
    document_manifest: result.documentManifest,
    error_code: null,
    error_message: null,
  };
}
