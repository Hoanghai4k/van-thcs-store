import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

/**
 * Validates whether a hash string strictly satisfies the Migration 016
 * document_view_artifacts_source_sha256_check constraint (64-char lowercase hex).
 */
export function validateSha256(hash: string): boolean {
  return SHA256_HEX_REGEX.test(hash);
}

/**
 * Computes SHA-256 strictly from raw file bytes.
 * Never includes filename, URL, or metadata in the hash.
 */
export async function computeSourceSha256(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  const hash = createHash("sha256").update(bytes).digest("hex").toLowerCase();

  if (!validateSha256(hash)) {
    throw new Error(`Generated hash '${hash}' does not satisfy Migration 016 SHA-256 format.`);
  }

  return hash;
}
