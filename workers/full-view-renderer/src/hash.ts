import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { RendererError } from "./errors.js";

export const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

/**
 * Validates whether a hash string satisfies the Migration 016
 * document_view_artifacts_source_sha256_check constraint (lowercase 64-char hex).
 */
export function validateSha256(hash: string): boolean {
  return SHA256_HEX_REGEX.test(hash);
}

/**
 * Computes SHA-256 strictly from raw file bytes.
 * Never includes filename, URL, timestamp, or filesystem metadata in the hash.
 */
export async function computeSourceSha256(filePath: string): Promise<string> {
  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch (err) {
    throw new RendererError("INVALID_SOURCE_PATH", `Cannot read file for hashing: ${filePath}`, err);
  }

  const hash = createHash("sha256").update(bytes).digest("hex").toLowerCase();

  if (!validateSha256(hash)) {
    throw new RendererError(
      "VALIDATION_FAILURE",
      `Computed hash '${hash}' does not satisfy Migration 016 lowercase 64-char hex format`
    );
  }

  return hash;
}
