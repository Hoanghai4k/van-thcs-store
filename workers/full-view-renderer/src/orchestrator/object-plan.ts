import { join } from "node:path";
import { RendererError } from "../errors.js";
import { validateSha256 } from "../hash.js";
import { formatPageFilename } from "../manifest.js";
import type { DocumentManifestEntry } from "../types.js";
import type { DerivedObjectItem, DerivedObjectPlan } from "./types.js";

/**
 * Builds the canonical deterministic storage prefix for an artifact version.
 * Format: derived/full-view/{productFileId}/{sourceSha256}/{rendererVersion}/
 * Strictly POSIX with trailing slash, no leading slash.
 */
export function buildStoragePrefix(
  productFileId: string,
  sourceSha256: string,
  rendererVersion: string
): string {
  if (!productFileId || typeof productFileId !== "string" || productFileId.trim().length === 0) {
    throw new RendererError("VALIDATION_FAILURE", "productFileId must be a non-empty string");
  }
  if (!validateSha256(sourceSha256)) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      `Invalid sourceSha256 '${sourceSha256}'. Must match ^[0-9a-f]{64}$`
    );
  }
  if (!rendererVersion || typeof rendererVersion !== "string" || rendererVersion.trim().length === 0) {
    throw new RendererError("VALIDATION_FAILURE", "rendererVersion must be a non-empty string");
  }

  // Prevent path traversal in parameters
  if (productFileId.includes("/") || productFileId.includes("\\") || productFileId.includes("..")) {
    throw new RendererError("VALIDATION_FAILURE", `Invalid productFileId contains path separators: ${productFileId}`);
  }
  if (rendererVersion.includes("/") || rendererVersion.includes("\\") || rendererVersion.includes("..")) {
    throw new RendererError("VALIDATION_FAILURE", `Invalid rendererVersion contains path separators: ${rendererVersion}`);
  }

  return `derived/full-view/${productFileId.trim()}/${sourceSha256.toLowerCase()}/${rendererVersion.trim()}/`;
}

/**
 * Validates that an S3/R2 storage object key is safe and POSIX-compliant:
 * - No leading slash
 * - No backslashes
 * - No empty segments (e.g. "//")
 * - No path traversal ("..")
 * - Valid ASCII characters
 */
export function validateObjectKey(key: string): void {
  if (!key || typeof key !== "string") {
    throw new RendererError("VALIDATION_FAILURE", "Object key must be a non-empty string");
  }

  if (key.startsWith("/")) {
    throw new RendererError("VALIDATION_FAILURE", `Object key must not start with leading slash: '${key}'`);
  }

  if (key.includes("\\")) {
    throw new RendererError("VALIDATION_FAILURE", `Object key must use POSIX slashes only (no backslashes): '${key}'`);
  }

  const segments = key.split("/");
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // Trailing slash for prefixes is permitted, but empty internal segments are not
    if (segment === "" && i < segments.length - 1) {
      throw new RendererError("VALIDATION_FAILURE", `Object key contains empty path segment: '${key}'`);
    }
    if (segment === ".." || segment === ".") {
      throw new RendererError("VALIDATION_FAILURE", `Object key contains forbidden traversal segment '${segment}': '${key}'`);
    }
  }
}

/**
 * Plans the complete set of derived storage objects from a verified render output.
 * Ensures deterministic, verifiable mapping from local files to remote R2 keys.
 */
export function planDerivedObjects(params: {
  productFileId: string;
  sourceSha256: string;
  rendererVersion: string;
  documentManifest: DocumentManifestEntry[];
  localOutputDirectory: string;
}): DerivedObjectPlan {
  const { productFileId, sourceSha256, rendererVersion, documentManifest, localOutputDirectory } = params;

  const storagePrefix = buildStoragePrefix(productFileId, sourceSha256, rendererVersion);
  validateObjectKey(storagePrefix);

  if (!Array.isArray(documentManifest) || documentManifest.length === 0) {
    throw new RendererError("VALIDATION_FAILURE", "Cannot plan objects with empty documentManifest");
  }

  const objects: DerivedObjectItem[] = [];
  let totalExpectedPages = 0;

  for (const entry of documentManifest) {
    if (!/^doc-\d{4}$/.test(entry.key)) {
      throw new RendererError("VALIDATION_FAILURE", `Invalid document manifest key '${entry.key}'`);
    }
    if (!Number.isInteger(entry.pageCount) || entry.pageCount < 1) {
      throw new RendererError("VALIDATION_FAILURE", `Invalid pageCount ${entry.pageCount} in document '${entry.key}'`);
    }

    totalExpectedPages += entry.pageCount;

    for (let pageNum = 1; pageNum <= entry.pageCount; pageNum++) {
      const filename = formatPageFilename(pageNum);
      const localFilePath = join(localOutputDirectory, entry.key, filename);
      const objectKey = `${storagePrefix}${entry.key}/${filename}`;

      validateObjectKey(objectKey);

      objects.push({
        objectKey,
        localFilePath,
        docKey: entry.key,
        pageNumber: pageNum,
      });
    }
  }

  const manifestObjectKey = `${storagePrefix}manifest.json`;
  validateObjectKey(manifestObjectKey);

  return {
    productFileId,
    sourceSha256,
    rendererVersion,
    storagePrefix,
    objects,
    manifestObjectKey,
    totalExpectedPages,
  };
}
