import { mkdir, rm, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { RendererError } from "./errors.js";
import { safeSpawn } from "./process.js";

export interface DocxConversionResult {
  intermediatePdfPath: string;
  tempDirectory: string;
  cleanup: () => Promise<void>;
}

/**
 * DOCX Adapter: Converts a DOCX file to an intermediate PDF using headless LibreOffice.
 *
 * Requirements:
 * - Uses safeSpawn with argument arrays (NO shell concatenation).
 * - Isolated temporary directory per conversion.
 * - Enforces conversion timeout watchdog.
 * - Cleanup in finally via returned cleanup callback or error handling.
 * - If LibreOffice is not installed or unavailable, throws controlled DOCX_RUNTIME_UNAVAILABLE error.
 *
 * Status:
 * DOCX ADAPTER READY
 * DOCX RUNTIME NOT YET PROVEN (LibreOffice not present in current local dev environment)
 */
export async function convertDocxToIntermediatePdf(
  docxPath: string,
  stagingRoot: string,
  timeoutMs: number = 60000
): Promise<DocxConversionResult> {
  const resolvedDocx = resolve(docxPath);
  const ext = extname(resolvedDocx).toLowerCase();

  if (ext !== ".docx") {
    throw new RendererError("UNSUPPORTED_FORMAT", `Expected .docx file, received: ${resolvedDocx}`);
  }

  // 1. Probe for soffice / libreoffice in environment
  const probe = await safeSpawn("soffice", ["--version"], { timeoutMs: 3000 });
  if (probe.code !== 0) {
    throw new RendererError(
      "DOCX_RUNTIME_UNAVAILABLE",
      "LibreOffice/soffice is not installed or not in PATH in the current execution environment. DOCX conversion requires a containerized worker with LibreOffice and Vietnamese-capable fonts."
    );
  }

  // 2. Prepare isolated staging directory
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const tempDir = join(stagingRoot, `.temp_docx_${Date.now()}_${randomSuffix}`);
  await mkdir(tempDir, { recursive: true });

  const cleanup = async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Non-fatal cleanup warning
    }
  };

  try {
    // 3. Convert DOCX -> PDF using argument array (no shell concatenation)
    const args = [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      tempDir,
      resolvedDocx,
    ];

    const conversionResult = await safeSpawn("soffice", args, { timeoutMs, cwd: tempDir });

    if (conversionResult.timedOut) {
      throw new RendererError(
        "RENDER_TIMEOUT",
        `DOCX conversion timed out after ${timeoutMs}ms: ${resolvedDocx}`
      );
    }

    if (conversionResult.code !== 0) {
      throw new RendererError(
        "RENDER_FAILURE",
        `DOCX conversion failed (exit code ${conversionResult.code}): ${conversionResult.stderr}`
      );
    }

    const docxBaseName = basename(resolvedDocx, ext);
    const expectedPdfPath = join(tempDir, `${docxBaseName}.pdf`);

    const pdfStat = await stat(expectedPdfPath);
    if (!pdfStat.isFile() || pdfStat.size === 0) {
      throw new RendererError(
        "RENDER_FAILURE",
        `DOCX conversion produced invalid or empty PDF: ${expectedPdfPath}`
      );
    }

    return {
      intermediatePdfPath: expectedPdfPath,
      tempDirectory: tempDir,
      cleanup,
    };
  } catch (err) {
    // Clean up temporary files on failure
    await cleanup();
    throw err;
  }
}
