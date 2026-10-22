import { validateSha256 } from "./hash.js";

export interface DocumentManifestItem {
  key: string;
  name: string;
  pageCount: number;
}

export type ArtifactStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED_RETRYABLE" | "FAILED_FINAL";

export interface FullViewArtifactMetadata {
  sourceSha256: string;
  rendererVersion: string;
  status: ArtifactStatus;
  storageProvider: "R2" | "SUPABASE";
  storagePrefix?: string | null;
  localOutputDirectory?: string;
  pageCount: number | null;
  documentManifest: DocumentManifestItem[];
  errorCode?: string | null;
  errorMessage?: string | null;
}

/**
 * Formats 1-based page index into a deterministic 4-digit zero-padded filename:
 * e.g., page 1 -> page-0001.webp
 */
export function formatPageFilename(pageNumber: number): string {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error(`Page number must be a positive integer, received: ${pageNumber}`);
  }
  return `page-${pageNumber.toString().padStart(4, "0")}.webp`;
}

/**
 * Validates full-view metadata against the strict invariants of Migration 016:
 * - document_view_artifacts_source_sha256_check
 * - document_view_artifacts_renderer_version_check
 * - document_view_artifacts_document_manifest_array_check
 * - document_view_artifacts_ready_check
 */
export function validateArtifactMetadata(meta: FullViewArtifactMetadata): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // SHA256 check
  if (!validateSha256(meta.sourceSha256)) {
    errors.push(`Invalid source SHA-256: '${meta.sourceSha256}' does not match ^[0-9a-f]{64}$`);
  }

  // Renderer version check
  if (!meta.rendererVersion || meta.rendererVersion.trim() === "") {
    errors.push("renderer_version cannot be empty or whitespace only");
  }

  // Manifest array check
  if (!Array.isArray(meta.documentManifest)) {
    errors.push("document_manifest must be an array");
  }

  // READY invariant check
  if (meta.status === "READY") {
    if (!meta.pageCount || meta.pageCount < 1) {
      errors.push(`READY status requires page_count >= 1, received: ${meta.pageCount}`);
    }

    if (!Array.isArray(meta.documentManifest) || meta.documentManifest.length < 1) {
      errors.push("READY status requires non-empty document_manifest array (length >= 1)");
    } else {
      const manifestSum = meta.documentManifest.reduce((acc, doc) => acc + (doc.pageCount || 0), 0);
      if (manifestSum !== meta.pageCount) {
        errors.push(
          `Sum of sub-document page counts (${manifestSum}) does not equal total page_count (${meta.pageCount})`
        );
      }

      for (const [idx, doc] of meta.documentManifest.entries()) {
        if (!doc.key || doc.key.trim() === "") {
          errors.push(`Manifest item [${idx}] missing valid key`);
        }
        if (!doc.name || doc.name.trim() === "") {
          errors.push(`Manifest item [${idx}] missing valid name`);
        }
        if (!doc.pageCount || doc.pageCount < 1) {
          errors.push(`Manifest item [${idx}] pageCount must be >= 1, received: ${doc.pageCount}`);
        }
      }
    }

    if (meta.errorCode !== null && meta.errorCode !== undefined) {
      errors.push(`READY status requires error_code to be NULL, received: ${meta.errorCode}`);
    }

    if (meta.errorMessage !== null && meta.errorMessage !== undefined) {
      errors.push(`READY status requires error_message to be NULL, received: ${meta.errorMessage}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
