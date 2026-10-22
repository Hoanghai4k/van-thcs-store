import { safeSpawn } from "./runtime.js";
import { rm } from "node:fs/promises";

export interface DocxConversionResult {
  success: boolean;
  pdfPath?: string;
  blockedLocally: boolean;
  message?: string;
  error?: string;
}

/**
 * Clean adapter interface for converting DOCX to an intermediate PDF.
 * If LibreOffice is unavailable, gracefully returns blockedLocally = true.
 * NEVER requires automatic system software installation.
 */
export async function convertDocxToPdf(
  docxPath: string,
  outDir: string
): Promise<DocxConversionResult> {
  // 1. Probe for soffice / libreoffice
  const probe = await safeSpawn("soffice", ["--version"], { timeoutMs: 3000 });
  if (probe.code !== 0) {
    return {
      success: false,
      blockedLocally: true,
      message: "DOCX RUNTIME BLOCKED LOCALLY: LibreOffice/soffice is not installed in the local environment.",
    };
  }

  // 2. Safe headless conversion using argument array
  const args = [
    "--headless",
    "--convert-to",
    "pdf",
    "--outdir",
    outDir,
    docxPath,
  ];

  const result = await safeSpawn("soffice", args, { timeoutMs: 60000 });

  if (result.code !== 0) {
    return {
      success: false,
      blockedLocally: false,
      error: `LibreOffice conversion failed (exit code ${result.code}): ${result.stderr}`,
    };
  }

  return {
    success: true,
    blockedLocally: false,
    message: "DOCX converted to intermediate PDF successfully.",
  };
}

/**
 * Safely removes intermediate PDF files generated during conversion.
 */
export async function cleanupIntermediateFile(filePath: string): Promise<void> {
  try {
    await rm(filePath, { force: true });
  } catch {
    // Non-fatal cleanup warning
  }
}
