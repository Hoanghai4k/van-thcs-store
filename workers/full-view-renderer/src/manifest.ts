import { stat } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "./config.js";
import { RendererError } from "./errors.js";
import { validateSha256 } from "./hash.js";
import type { DocumentManifestEntry } from "./types.js";

export const DOC_KEY_REGEX = /^doc-\d{4}$/;
export const PAGE_FILENAME_REGEX = /^page-(\d{4})\.webp$/;

/**
 * Formats a 1-based page number to 4-digit zero-padded filename: "page-0001.webp".
 * Throws PAGE_COUNT_EXCEEDS_NAMING_LIMIT if page exceeds 9999.
 */
export function formatPageFilename(pageNumber: number, maxPages: number = DEFAULT_CONFIG.maxPageNumber): string {
  if (pageNumber < 1) {
    throw new RendererError("VALIDATION_FAILURE", `Page number must be >= 1, received: ${pageNumber}`);
  }
  if (pageNumber > maxPages) {
    throw new RendererError(
      "PAGE_COUNT_EXCEEDS_NAMING_LIMIT",
      `Page number ${pageNumber} exceeds maximum 4-digit naming limit (${maxPages})`
    );
  }
  return `page-${pageNumber.toString().padStart(4, "0")}.webp`;
}

/**
 * Formats a 1-based document index to 4-digit zero-padded folder: "doc-0001".
 */
export function formatDocKey(docIndex: number = 1): string {
  if (docIndex < 1 || docIndex > 9999) {
    throw new RendererError("VALIDATION_FAILURE", `Document index must be between 1 and 9999, received: ${docIndex}`);
  }
  return `doc-${docIndex.toString().padStart(4, "0")}`;
}

/**
 * Assembles a standard single-document manifest entry.
 */
export function createDefaultDocumentManifest(displayName: string, pageCount: number): DocumentManifestEntry[] {
  if (pageCount < 1) {
    throw new RendererError("ZERO_PAGE_DOCUMENT", "Cannot create manifest for 0-page document");
  }
  return [
    {
      key: formatDocKey(1),
      name: displayName,
      pageCount,
    },
  ];
}

/**
 * Validates complete render artifacts on disk against Migration 016 invariants.
 *
 * Requirements:
 * - SHA256 valid (lowercase 64-char hex)
 * - Manifest is non-empty array
 * - Each document key valid ("doc-0001")
 * - Document pageCount >= 1
 * - Sum of manifest pageCounts === top-level pageCount
 * - Every expected WebP exists on disk
 * - No numbering gaps (1..N contiguous)
 * - Every WebP size > 0 bytes
 */
export async function validateRenderArtifacts(
  outputDirectory: string,
  sourceSha256: string,
  pageCount: number,
  manifest: DocumentManifestEntry[]
): Promise<void> {
  // 1. Validate SHA256
  if (!validateSha256(sourceSha256)) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      `Invalid source SHA256: '${sourceSha256}'. Must match ^[0-9a-f]{64}$`
    );
  }

  // 2. Validate top-level page count
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      `Invalid top-level page count: ${pageCount}. Must be an integer >= 1`
    );
  }

  // 3. Validate manifest structure
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new RendererError("VALIDATION_FAILURE", "Manifest must be a non-empty array");
  }

  let totalManifestPages = 0;

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    if (!entry || typeof entry !== "object") {
      throw new RendererError("VALIDATION_FAILURE", `Manifest entry at index ${i} is not a valid object`);
    }

    if (!DOC_KEY_REGEX.test(entry.key)) {
      throw new RendererError(
        "VALIDATION_FAILURE",
        `Invalid manifest key '${entry.key}' at index ${i}. Must match ^doc-\\d{4}$`
      );
    }

    if (typeof entry.name !== "string" || entry.name.trim().length === 0) {
      throw new RendererError(
        "VALIDATION_FAILURE",
        `Invalid manifest name at index ${i}. Must be non-empty string`
      );
    }

    if (!Number.isInteger(entry.pageCount) || entry.pageCount < 1) {
      throw new RendererError(
        "VALIDATION_FAILURE",
        `Invalid pageCount ${entry.pageCount} at index ${i}. Must be >= 1`
      );
    }

    totalManifestPages += entry.pageCount;

    // Check disk files for this document entry
    const docDirPath = join(outputDirectory, entry.key);

    for (let p = 1; p <= entry.pageCount; p++) {
      const filename = formatPageFilename(p);
      const filePath = join(docDirPath, filename);

      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) {
          throw new RendererError("VALIDATION_FAILURE", `Expected artifact is not a file: ${filePath}`);
        }
        if (fileStat.size <= 0) {
          throw new RendererError("VALIDATION_FAILURE", `Zero-byte WebP artifact detected: ${filePath}`);
        }
      } catch (err) {
        if (err instanceof RendererError) throw err;
        throw new RendererError(
          "VALIDATION_FAILURE",
          `Missing page artifact or file stat error at page ${p}: ${filePath}`,
          err
        );
      }
    }
  }

  // 4. Validate page count invariant: sum(manifest.pageCount) === pageCount
  if (totalManifestPages !== pageCount) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      `Manifest page count sum (${totalManifestPages}) does not equal top-level page count (${pageCount})`
    );
  }
}
