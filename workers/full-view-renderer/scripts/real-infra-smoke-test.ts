import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { computeSourceSha256 } from "../src/hash.js";
import { renderPdf } from "../src/pdf-renderer.js";
import { R2DerivedStorage } from "../src/orchestrator/r2-storage.js";
import { SupabaseArtifactRepository } from "../src/orchestrator/supabase-repository.js";
import { planDerivedObjects } from "../src/orchestrator/object-plan.js";

interface SmokeTestReport {
  status: "PASS" | "FAIL" | "CLEANUP_REQUIRED";
  supabaseProject: string;
  r2Bucket: string;
  siteAVerified: boolean;
  productFileId: string;
  sourceSha256: string;
  rendererVersion: string;
  smokePrefix: string;
  artifactId?: string;
  dbLifecycle: {
    pendingCreated: boolean;
    processingClaimed: boolean;
    readyUpdated: boolean;
    verifiedReadyInDb: boolean;
  };
  r2Lifecycle: {
    uploadedCount: number;
    verifiedCount: number;
    contentTypeWebp: string;
    contentTypeManifest: string;
  };
  cleanup: {
    r2ObjectsDeleted: boolean;
    remainingR2Objects: number;
    dbRowDeleted: boolean;
    preTestDbCount: number;
    postTestDbCount: number;
  };
  errors: string[];
}

function loadEnv(): {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2Endpoint?: string;
} {
  // Read root .env.local safely
  const envPath = resolve(__dirname, "../../../.env.local");
  const content = readFileSync(envPath, "utf8");

  const getVar = (name: string): string => {
    const match = content.match(new RegExp(`^${name}=([^\\r\\n]+)`, "m"));
    if (!match) throw new Error(`Missing required env var: ${name}`);
    return match[1].trim();
  };

  const getOptional = (name: string): string | undefined => {
    const match = content.match(new RegExp(`^${name}=([^\\r\\n]+)`, "m"));
    return match ? match[1].trim() : undefined;
  };

  return {
    supabaseUrl: getVar("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: getVar("SUPABASE_SERVICE_ROLE_KEY"),
    r2AccountId: getVar("R2_ACCOUNT_ID"),
    r2AccessKeyId: getVar("R2_ACCESS_KEY_ID"),
    r2SecretAccessKey: getVar("R2_SECRET_ACCESS_KEY"),
    r2BucketName: getVar("R2_BUCKET_NAME"),
    r2Endpoint: getOptional("R2_ENDPOINT"),
  };
}

async function runRealInfraSmokeTest(): Promise<SmokeTestReport> {
  const errors: string[] = [];
  const env = loadEnv();

  // 1. Verify Site A configuration
  const expectedSupabaseHost = "zbvguslcqdufnkiwqkym.supabase.co";
  const expectedR2Bucket = "tailieuhangcao-product-files";

  const siteAVerified =
    env.supabaseUrl.includes(expectedSupabaseHost) &&
    env.r2BucketName === expectedR2Bucket;

  if (!siteAVerified) {
    throw new Error(
      `Site A verification failed! URL='${env.supabaseUrl}', bucket='${env.r2BucketName}'. Refusing to run on unconfirmed environment.`
    );
  }

  console.log("=== Phase 2G Real Infrastructure Smoke Test ===");
  console.log("Site A verified:       YES");
  console.log("Supabase project:      zbvguslcqdufnkiwqkym");
  console.log("R2 bucket:             tailieuhangcao-product-files");
  console.log("Credentials configured: YES (values redacted)");

  const repository = new SupabaseArtifactRepository({
    supabaseUrl: env.supabaseUrl,
    supabaseServiceRoleKey: env.supabaseServiceRoleKey,
  });

  const storage = new R2DerivedStorage({
    accountId: env.r2AccountId,
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey,
    bucketName: env.r2BucketName,
    endpointOverride: env.r2Endpoint,
  });

  // 2. Product File FK Anchor
  // Use known safe Site A product_file_id without touching its contents or metadata
  const productFileId = "5af3701e-08d2-4b66-9177-e72695417b80";
  const rendererVersion = "smoke-test-v1";

  // 3. Synthetic PDF input
  const fixturePath = resolve(__dirname, "../fixtures/standard-lesson-3p.pdf");
  const sourceSha256 = await computeSourceSha256(fixturePath);

  // 4. Isolated smoke test run prefix
  const runId = Date.now().toString();
  const smokePrefix = `derived/full-view-smoke-tests/${runId}/${productFileId}/${sourceSha256}/${rendererVersion}/`;
  console.log("Smoke prefix:         ", smokePrefix);

  const report: SmokeTestReport = {
    status: "PASS",
    supabaseProject: "zbvguslcqdufnkiwqkym",
    r2Bucket: env.r2BucketName,
    siteAVerified: true,
    productFileId,
    sourceSha256,
    rendererVersion,
    smokePrefix,
    dbLifecycle: {
      pendingCreated: false,
      processingClaimed: false,
      readyUpdated: false,
      verifiedReadyInDb: false,
    },
    r2Lifecycle: {
      uploadedCount: 0,
      verifiedCount: 0,
      contentTypeWebp: "image/webp",
      contentTypeManifest: "application/json",
    },
    cleanup: {
      r2ObjectsDeleted: false,
      remainingR2Objects: -1,
      dbRowDeleted: false,
      preTestDbCount: -1,
      postTestDbCount: -1,
    },
    errors,
  };

  let artifactId: string | undefined;
  const scratchDir = resolve(__dirname, `../output/smoke-test-${runId}`);

  try {
    // 5. Pre-test DB count
    report.cleanup.preTestDbCount = await repository.countArtifacts();
    console.log(`Pre-test DB rows:      ${report.cleanup.preTestDbCount}`);

    // Ensure no pre-existing row for this synthetic hash and version
    const existing = await repository.findVersion(productFileId, sourceSha256, rendererVersion);
    if (existing) {
      throw new Error(`Pre-existing artifact found for smoke test identity! id=${existing.id}`);
    }

    // 6. Local render
    console.log("Rendering synthetic PDF locally...");
    const renderResult = await renderPdf({
      inputPath: fixturePath,
      displayName: "Giao An Ngu Van Smoke Test",
      outputRoot: scratchDir,
      rendererVersion,
      pageWidth: 1600,
      webpQuality: 85,
    });
    console.log(`Rendered ${renderResult.pageCount} pages successfully.`);

    // 7. DB Step 1: Create PENDING row
    console.log("DB Step 1: Creating PENDING record...");
    const pendingRow = await repository.createPending({
      productFileId,
      sourceSha256,
      rendererVersion,
      storageProvider: "R2",
      storagePrefix: smokePrefix,
    });
    artifactId = pendingRow.id;
    report.artifactId = artifactId;
    report.dbLifecycle.pendingCreated = true;
    console.log(`PENDING row created:   id=${artifactId}`);

    // 8. DB Step 2: Atomic conditional claim (PROCESSING)
    console.log("DB Step 2: Claiming PROCESSING (atomic conditional update)...");
    const processingRow = await repository.markProcessing(artifactId);
    if (processingRow.status !== "PROCESSING") {
      throw new Error(`Expected status PROCESSING, received: ${processingRow.status}`);
    }
    report.dbLifecycle.processingClaimed = true;
    console.log("PROCESSING claimed:    YES");

    // 9. Plan objects
    const plan = planDerivedObjects({
      productFileId,
      sourceSha256,
      rendererVersion,
      documentManifest: renderResult.documentManifest,
      localOutputDirectory: renderResult.localOutputDirectory,
    });

    // Remap planned object keys to smokePrefix
    const smokePageObjects = plan.objects.map((item) => ({
      ...item,
      smokeObjectKey: `${smokePrefix}${item.docKey}/${item.pageNumber.toString().padStart(4, "0")}.webp`.replace(
        `${item.docKey}/${item.pageNumber.toString().padStart(4, "0")}.webp`,
        `doc-0001/page-${item.pageNumber.toString().padStart(4, "0")}.webp`
      ),
    }));
    const smokeManifestKey = `${smokePrefix}manifest.json`;

    // 10. R2 Upload
    console.log(`Uploading ${smokePageObjects.length} pages to private R2...`);
    for (const item of smokePageObjects) {
      await storage.uploadFile(item.smokeObjectKey, item.localFilePath, "image/webp");
      report.r2Lifecycle.uploadedCount++;
    }

    await storage.uploadFile(smokeManifestKey, renderResult.manifestFilePath, "application/json");
    report.r2Lifecycle.uploadedCount++;
    console.log(`Uploaded ${report.r2Lifecycle.uploadedCount} objects to R2 smoke prefix.`);

    // 11. Real Storage Verification (HEAD check)
    console.log("Verifying objects exist in R2...");
    for (const item of smokePageObjects) {
      const exists = await storage.objectExists(item.smokeObjectKey);
      if (!exists) {
        throw new Error(`R2 verification failed: missing object '${item.smokeObjectKey}'`);
      }
      report.r2Lifecycle.verifiedCount++;
    }

    const manifestExists = await storage.objectExists(smokeManifestKey);
    if (!manifestExists) {
      throw new Error(`R2 verification failed: missing manifest '${smokeManifestKey}'`);
    }
    report.r2Lifecycle.verifiedCount++;
    console.log(`Verified ${report.r2Lifecycle.verifiedCount} objects exist in R2.`);

    // 12. DB Step 3: Update to READY
    console.log("DB Step 3: Updating artifact to READY...");
    const readyRow = await repository.markReady(artifactId, {
      pageCount: renderResult.pageCount,
      documentManifest: renderResult.documentManifest,
      storagePrefix: smokePrefix,
    });
    report.dbLifecycle.readyUpdated = true;

    // 13. Re-read and assert READY invariants
    console.log("Verifying DB record in Supabase...");
    const verifiedRow = await repository.findVersion(productFileId, sourceSha256, rendererVersion);
    if (!verifiedRow) {
      throw new Error("Cannot re-read artifact from DB!");
    }

    if (
      verifiedRow.status === "READY" &&
      verifiedRow.source_sha256 === sourceSha256 &&
      verifiedRow.renderer_version === rendererVersion &&
      verifiedRow.storage_provider === "R2" &&
      verifiedRow.storage_prefix === smokePrefix &&
      verifiedRow.page_count === 3 &&
      Array.isArray(verifiedRow.document_manifest) &&
      verifiedRow.document_manifest.length === 1 &&
      verifiedRow.error_code === null &&
      verifiedRow.error_message === null
    ) {
      report.dbLifecycle.verifiedReadyInDb = true;
      console.log("DB record verified:    READY invariants satisfied.");
    } else {
      throw new Error(`DB record verification failed: ${JSON.stringify(verifiedRow)}`);
    }
  } catch (err: any) {
    report.status = "FAIL";
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    console.error("SMOKE TEST ENCOUNTERED ERROR:", msg);
  } finally {
    // 14. MANDATORY FULL CLEANUP
    console.log("\n--- EXECUTING MANDATORY CLEANUP ---");

    // Clean R2 smoke prefix
    try {
      console.log(`Purging R2 objects under '${smokePrefix}'...`);
      const delRes = await storage.deletePrefix(smokePrefix);
      console.log(`Deleted ${delRes.deletedCount} R2 objects.`);

      // Verify prefix contains 0 objects
      const remainingR2 = await storage.countPrefix(smokePrefix);
      report.cleanup.remainingR2Objects = remainingR2;
      report.cleanup.r2ObjectsDeleted = remainingR2 === 0;
      console.log(`Remaining R2 smoke objects: ${remainingR2}`);
    } catch (cleanupErr: any) {
      report.status = "CLEANUP_REQUIRED";
      errors.push(`R2 cleanup failed: ${cleanupErr.message}`);
      console.error("R2 CLEANUP ERROR:", cleanupErr);
    }

    // Clean DB test row
    if (artifactId) {
      try {
        console.log(`Deleting exact DB row id='${artifactId}'...`);
        const dbDeleted = await repository.deleteExactRow(artifactId);
        report.cleanup.dbRowDeleted = dbDeleted;
        console.log(`DB row deleted:        ${dbDeleted}`);

        // Post-test DB row count
        report.cleanup.postTestDbCount = await repository.countArtifacts();
        console.log(`Post-test DB rows:     ${report.cleanup.postTestDbCount}`);
      } catch (dbCleanupErr: any) {
        report.status = "CLEANUP_REQUIRED";
        errors.push(`DB cleanup failed: ${dbCleanupErr.message}`);
        console.error("DB CLEANUP ERROR:", dbCleanupErr);
      }
    } else {
      report.cleanup.postTestDbCount = await repository.countArtifacts();
    }

    // Clean local scratch files
    try {
      await rm(scratchDir, { recursive: true, force: true });
      console.log("Local scratch output cleaned.");
    } catch {
      // Ignored
    }

    // Final safety evaluation
    if (report.cleanup.remainingR2Objects !== 0 || report.cleanup.postTestDbCount !== report.cleanup.preTestDbCount) {
      report.status = "CLEANUP_REQUIRED";
    }
  }

  console.log("===============================================");
  console.log(`FINAL SMOKE TEST RESULT: ${report.status}`);
  console.log("===============================================");

  return report;
}

runRealInfraSmokeTest()
  .then((report) => {
    if (report.status !== "PASS") {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
  });
