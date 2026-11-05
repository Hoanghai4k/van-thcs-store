/**
 * Server/Developer Full-View Preparation Script.
 *
 * Usage:
 *   tsx scripts/prepare.ts --product-file-id=<uuid>
 *   or from root:
 *   npm run full-view:prepare -- --product-file-id=<uuid>
 *
 * Performs:
 * 1. Loads product_file metadata server-side via Supabase Service Role.
 * 2. Downloads the actual private source file from storage (Supabase or R2).
 * 3. Handles source formats:
 *    - PDF: native render using proven Node PDF -> WebP renderer.
 *    - DOCX: if LibreOffice available -> local convert; else uses CloudConvert
 *      for ONE full intermediate PDF conversion; else fails with DOCX_RUNTIME_UNAVAILABLE.
 *    - ZIP: rejected (thesis scope: online viewing unsupported for ZIP).
 * 4. Invokes DocumentOrchestrator to:
 *    - Compute source SHA-256
 *    - Idempotently skip if already READY for same hash & renderer_version
 *    - Render pages to WebP
 *    - Upload page WebP images and manifest to private R2
 *    - Strictly verify all uploaded objects in R2
 *    - Update document_view_artifacts to READY
 * 5. Cleans up local ephemeral scratch files.
 */

import { readFileSync } from "node:fs";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { resolve, join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { DEFAULT_CONFIG } from "../src/config.js";
import { computeSourceSha256 } from "../src/hash.js";
import { renderPdf } from "../src/pdf-renderer.js";
import { DocumentOrchestrator } from "../src/orchestrator/orchestrator.js";
import { SupabaseArtifactRepository } from "../src/orchestrator/supabase-repository.js";
import { R2DerivedStorage } from "../src/orchestrator/r2-storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface EnvConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2Endpoint?: string;
  cloudConvertApiKey?: string;
}

function loadEnv(): EnvConfig {
  const envPath = resolve(__dirname, "../../../.env.local");
  const content = readFileSync(envPath, "utf8");

  const getVar = (name: string, required = true): string => {
    const match = content.match(new RegExp(`^${name}=([^\\r\\n]+)`, "m"));
    if (!match || !match[1].trim()) {
      if (required) throw new Error(`Missing required env var in .env.local: ${name}`);
      return "";
    }
    return match[1].trim();
  };

  return {
    supabaseUrl: getVar("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: getVar("SUPABASE_SERVICE_ROLE_KEY"),
    r2AccountId: getVar("R2_ACCOUNT_ID"),
    r2AccessKeyId: getVar("R2_ACCESS_KEY_ID"),
    r2SecretAccessKey: getVar("R2_SECRET_ACCESS_KEY"),
    r2BucketName: getVar("R2_BUCKET_NAME"),
    r2Endpoint: getVar("R2_ENDPOINT", false) || undefined,
    cloudConvertApiKey: getVar("CLOUDCONVERT_API_KEY", false) || undefined,
  };
}

function parseArgs(): { productFileId: string; force: boolean } {
  const args = process.argv.slice(2);
  let productFileId = "";
  let force = false;

  for (const arg of args) {
    if (arg.startsWith("--product-file-id=")) {
      productFileId = arg.split("=")[1].trim();
    } else if (arg === "--force") {
      force = true;
    } else if (!arg.startsWith("--") && !productFileId) {
      productFileId = arg.trim();
    }
  }

  if (!productFileId) {
    console.error("Usage: npm run full-view:prepare -- --product-file-id=<uuid> [--force]");
    process.exit(1);
  }

  return { productFileId, force };
}

function isLibreOfficeAvailable(): boolean {
  try {
    execSync("soffice --version", { stdio: "ignore" });
    return true;
  } catch {
    try {
      execSync("libreoffice --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
}

async function convertDocxViaCloudConvert(params: {
  signedSourceUrl: string;
  apiKey: string;
  destPath: string;
}): Promise<void> {
  const { signedSourceUrl, apiKey, destPath } = params;

  console.log("[DOCX Conversion] Creating CloudConvert full DOCX -> PDF job...");
  console.log("[DOCX Conversion] Quota note: 1 CloudConvert conversion credit will be consumed.");

  const createRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tasks: {
        "import-docx": {
          operation: "import/url",
          url: signedSourceUrl,
        },
        "convert-pdf": {
          operation: "convert",
          input: "import-docx",
          input_format: "docx",
          output_format: "pdf",
        },
        "export-pdf": {
          operation: "export/url",
          input: "convert-pdf",
        },
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`CloudConvert job creation failed (${createRes.status}): ${errText}`);
  }

  const jobData = await createRes.json();
  const jobId = jobData.data.id;
  console.log(`[DOCX Conversion] Job submitted: ${jobId}. Polling completion...`);

  // Poll until job completes (up to 180 seconds)
  const maxWaitMs = 180_000;
  const pollIntervalMs = 2_000;
  const startTime = Date.now();
  let exportUrl: string | null = null;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const pollRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue;

    const currentJob = await pollRes.json();
    const status = currentJob.data.status;

    if (status === "finished") {
      const exportTask = currentJob.data.tasks.find(
        (t: { operation: string; status: string }) => t.operation === "export/url" && t.status === "finished",
      );
      if (exportTask?.result?.files?.[0]?.url) {
        exportUrl = exportTask.result.files[0].url;
        break;
      }
    } else if (status === "error") {
      throw new Error(`CloudConvert job failed: ${JSON.stringify(currentJob.data.tasks)}`);
    }
  }

  if (!exportUrl) {
    throw new Error("Timed out waiting for CloudConvert DOCX conversion to finish.");
  }

  console.log("[DOCX Conversion] Intermediate PDF generated. Downloading bytes...");
  const dlRes = await fetch(exportUrl);
  if (!dlRes.ok) {
    throw new Error(`Failed to download intermediate PDF: ${dlRes.statusText}`);
  }

  const pdfBuffer = Buffer.from(await dlRes.arrayBuffer());
  await writeFile(destPath, pdfBuffer);
  console.log(`[DOCX Conversion] Successfully saved intermediate PDF: ${destPath} (${pdfBuffer.length} bytes)`);
}

async function main() {
  const { productFileId, force } = parseArgs();
  const env = loadEnv();

  console.log("==================================================");
  console.log("SECURE FULL-VIEW DOCUMENT PREPARATION");
  console.log("==================================================");
  console.log(`Product File ID:  ${productFileId}`);
  console.log(`Force Retry:      ${force}`);
  console.log(`Renderer Version: ${DEFAULT_CONFIG.rendererVersion}`);

  // 1. Initialize Supabase Admin client
  const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  // 2. Fetch product_file metadata
  const { data: file, error: fileError } = await supabase
    .from("product_files")
    .select("id, product_id, file_name, storage_path, storage_provider, products(id, name, slug)")
    .eq("id", productFileId)
    .single();

  if (fileError || !file) {
    console.error(`[Error] product_files record not found for id: ${productFileId}`);
    process.exit(1);
  }

  const fileName = file.file_name;
  const ext = extname(fileName).toLowerCase();
  const productInfo = Array.isArray(file.products) ? file.products[0] : file.products;
  const productName = productInfo?.name || "Sản phẩm";

  console.log(`Target Document:  ${fileName} (${productName})`);
  console.log(`Storage Provider: ${file.storage_provider}`);
  console.log(`Storage Path:     ${file.storage_path}`);

  // 3. Format boundary checks
  if (ext === ".zip") {
    console.error(
      `[Rejected] ZIP file format is OUT OF THESIS SCOPE. Online full viewing is not supported for archives.`,
    );
    process.exit(1);
  }

  if (ext !== ".pdf" && ext !== ".docx") {
    console.error(`[Rejected] Unsupported document format '${ext}'. Only PDF and DOCX are supported.`);
    process.exit(1);
  }

  // 4. Setup temporary scratch space
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const scratchDir = resolve(__dirname, `../output/prepare-${runId}`);
  await mkdir(scratchDir, { recursive: true });

  const rawSourcePath = join(scratchDir, fileName);
  let readyPdfPath = "";

  // Helper S3 client for R2 downloads and signed URLs
  const r2Client = new S3Client({
    region: "auto",
    endpoint: env.r2Endpoint || `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
  });

  try {
    // 5. Download private source bytes
    console.log("[Download] Fetching private source file from storage...");
    let sourceBuffer: Buffer;
    let signedSourceUrl: string;

    if (file.storage_provider === "R2") {
      const getCmd = new GetObjectCommand({
        Bucket: env.r2BucketName,
        Key: file.storage_path,
      });
      const s3Res = await r2Client.send(getCmd);
      if (!s3Res.Body) throw new Error("Empty body received from R2");
      const bytes = await s3Res.Body.transformToByteArray();
      sourceBuffer = Buffer.from(bytes);
      signedSourceUrl = await getSignedUrl(r2Client, getCmd, { expiresIn: 3600 });
    } else {
      // Supabase Storage (product-files bucket)
      const { data: dlData, error: dlError } = await supabase.storage
        .from("product-files")
        .download(file.storage_path);
      if (dlError || !dlData) {
        throw new Error(`Failed to download from Supabase storage: ${dlError?.message}`);
      }
      sourceBuffer = Buffer.from(await dlData.arrayBuffer());

      const { data: signData, error: signError } = await supabase.storage
        .from("product-files")
        .createSignedUrl(file.storage_path, 3600);
      if (signError || !signData?.signedUrl) {
        throw new Error(`Failed to create signed URL from Supabase storage: ${signError?.message}`);
      }
      signedSourceUrl = signData.signedUrl;
    }

    await writeFile(rawSourcePath, sourceBuffer);
    console.log(`[Download] Downloaded ${sourceBuffer.length} bytes to ${rawSourcePath}`);

    // Compute byte-level SHA-256 of the actual raw source file
    const rawSourceSha256 = await computeSourceSha256(rawSourcePath);
    console.log(`[Hash] Authoritative source SHA-256: ${rawSourceSha256}`);

    // Initialize repository early to verify if this exact file version is already READY
    const repository = new SupabaseArtifactRepository({
      supabaseUrl: env.supabaseUrl,
      supabaseServiceRoleKey: env.supabaseServiceRoleKey,
    });

    const existingArtifact = await repository.findVersion(
      productFileId,
      rawSourceSha256,
      DEFAULT_CONFIG.rendererVersion,
    );

    if (existingArtifact && existingArtifact.status === "READY" && !force) {
      console.log("==================================================");
      console.log("STATUS: ALREADY READY (IDEMPOTENT SKIP)");
      console.log("==================================================");
      console.log(`Artifact ID:      ${existingArtifact.id}`);
      console.log(`Page Count:       ${existingArtifact.page_count}`);
      console.log(`Source SHA-256:   ${existingArtifact.source_sha256}`);
      console.log(`Renderer Version: ${existingArtifact.renderer_version}`);
      console.log(`Storage Prefix:   ${existingArtifact.storage_prefix}`);
      console.log("==================================================");
      return;
    }

    // 6. Convert DOCX if necessary
    if (ext === ".pdf") {
      readyPdfPath = rawSourcePath;
    } else if (ext === ".docx") {
      console.log("[DOCX Source] Checking available conversion runtimes...");
      const intermediatePdfPath = join(scratchDir, `${fileName.replace(/\.docx$/i, "")}.pdf`);

      if (isLibreOfficeAvailable()) {
        console.log("[DOCX Source] LibreOffice detected locally. Converting to intermediate PDF...");
        execSync(`soffice --headless --convert-to pdf --outdir "${scratchDir}" "${rawSourcePath}"`, {
          stdio: "inherit",
        });
        readyPdfPath = intermediatePdfPath;
      } else if (env.cloudConvertApiKey) {
        console.log("[DOCX Source] LibreOffice not installed. Using configured CloudConvert for intermediate PDF...");
        await convertDocxViaCloudConvert({
          signedSourceUrl,
          apiKey: env.cloudConvertApiKey,
          destPath: intermediatePdfPath,
        });
        readyPdfPath = intermediatePdfPath;
      } else {
        console.error("==================================================");
        console.error("BLOCKER: DOCX_RUNTIME_UNAVAILABLE");
        console.error("No LibreOffice found on the host machine and no CLOUDCONVERT_API_KEY is configured.");
        console.error("Cannot safely prepare DOCX full view without an authoritative converter.");
        console.error("==================================================");
        process.exit(1);
      }
    }

    // 7. Initialize Storage and Orchestrator
    const storage = new R2DerivedStorage({
      accountId: env.r2AccountId,
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
      bucketName: env.r2BucketName,
      endpointOverride: env.r2Endpoint,
    });

    const orchestrator = new DocumentOrchestrator({
      repository,
      storage,
      renderer: renderPdf,
      localScratchRoot: scratchDir,
      storageProvider: "R2",
    });

    // 8. Run atomic orchestrator pipeline
    console.log("[Orchestrator] Running full-view rendering pipeline...");
    const result = await orchestrator.processDocument({
      productFileId,
      sourceFilePath: readyPdfPath,
      displayName: fileName,
      rendererVersion: DEFAULT_CONFIG.rendererVersion,
      sourceSha256Override: rawSourceSha256,
      forceRetry: force,
    });

    console.log("==================================================");
    if (result.skippedBecauseAlreadyReady) {
      console.log("STATUS: ALREADY READY (IDEMPOTENT SKIP)");
    } else {
      console.log("STATUS: SUCCESS — READY");
    }
    console.log("==================================================");
    console.log(`Artifact ID:      ${result.artifactId}`);
    console.log(`Page Count:       ${result.pageCount}`);
    console.log(`Source SHA-256:   ${result.sourceSha256}`);
    console.log(`Renderer Version: ${result.rendererVersion}`);
    console.log(`Storage Prefix:   ${result.storagePrefix}`);
    console.log(`Uploaded Objects: ${result.uploadedObjectsCount}`);
    console.log("==================================================");
  } finally {
    // 9. Clean up scratch directory
    try {
      await rm(scratchDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}

main().catch((err) => {
  console.error("[Fatal Error in prepare]", err);
  process.exit(1);
});

