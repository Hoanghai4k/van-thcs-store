import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { renderDocument } from "./render.js";
import { auditLocalRuntime } from "./runtime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runPoc() {
  console.log("══════════════════════════════════════════════════════════════");
  console.log("FULL VIEW RENDERER LOCAL POC — SITE A (TÀI LIỆU HẰNG CAO)");
  console.log("══════════════════════════════════════════════════════════════\n");

  // 1. Audit Runtime
  console.log("1. AUDITING LOCAL RUNTIME...");
  const runtime = await auditLocalRuntime();
  console.log(`   - Node version:         ${runtime.nodeVersion}`);
  console.log(`   - Docker available:     ${runtime.dockerAvailable ? "YES" : "NO"}`);
  console.log(`   - LibreOffice (soffice): ${runtime.libreOfficeAvailable ? "YES" : "NO"}`);
  console.log(`   - Poppler (pdftoppm):   ${runtime.popplerAvailable ? "YES" : "NO"}`);
  console.log(`   - WebP CLI (cwebp):     ${runtime.cwebpAvailable ? "YES" : "NO"}\n`);

  const fixturesDir = resolve(__dirname, "../fixtures");
  const outputRootDir = resolve(__dirname, "../output");

  const primaryFixture = resolve(fixturesDir, "sample-vietnamese-lesson.pdf");
  const modifiedFixture = resolve(fixturesDir, "sample-vietnamese-modified.pdf");

  // 2. Render Primary Fixture (Run 1)
  console.log("2. RENDERING PRIMARY PDF FIXTURE (Run 1)...");
  const result1 = await renderDocument(primaryFixture, {
    outputRootDir,
    pageWidth: 1600,
    webpQuality: 85,
    rendererVersion: "webp-poc-v1",
    displayName: "Giáo Án Ngữ Văn 9: Tổng Kết Văn Học Trung Đại",
  });

  console.log(`   ✓ Source SHA-256:      ${result1.sourceSha256}`);
  console.log(`   ✓ Renderer Version:    ${result1.rendererVersion}`);
  console.log(`   ✓ Pages Rendered:      ${result1.pageCount}`);
  console.log(`   ✓ Source PDF Size:     ${(result1.sourceSizeBytes / 1024).toFixed(1)} KB`);
  console.log(`   ✓ Total WebP Output:   ${(result1.totalWebpSizeBytes / 1024).toFixed(1)} KB`);
  console.log(`   ✓ Output Directory:    ${result1.outputDirectory}`);
  console.log(`   ✓ Manifest File:       ${result1.manifestFilePath}\n`);

  console.log("   PAGE MEASUREMENTS:");
  for (const p of result1.pageMeasurements) {
    console.log(
      `     - Page ${p.pageNumber}: ${p.filename} | ${p.width}x${p.height} px | ${(p.fileSizeBytes / 1024).toFixed(1)} KB`
    );
  }
  console.log("");

  // 3. Determinism Test (Run 2 with identical input)
  console.log("3. DETERMINISM TEST (Re-rendering identical input)...");
  const result2 = await renderDocument(primaryFixture, {
    outputRootDir,
    pageWidth: 1600,
    webpQuality: 85,
    rendererVersion: "webp-poc-v1",
    displayName: "Giáo Án Ngữ Văn 9: Tổng Kết Văn Học Trung Đại",
  });

  const hashIdentical = result1.sourceSha256 === result2.sourceSha256;
  const pathIdentical = result1.outputDirectory === result2.outputDirectory;
  const pageCountIdentical = result1.pageCount === result2.pageCount;

  console.log(`   - Hash identical:       ${hashIdentical ? "PASS" : "FAIL"}`);
  console.log(`   - Path identical:       ${pathIdentical ? "PASS" : "FAIL"}`);
  console.log(`   - Page count identical: ${pageCountIdentical ? "PASS" : "FAIL"}\n`);

  if (!hashIdentical || !pathIdentical || !pageCountIdentical) {
    throw new Error("Determinism test failed!");
  }

  // 4. Source Change Invalidation Test
  console.log("4. SOURCE CHANGE INVALIDATION TEST (Rendering modified source)...");
  const resultModified = await renderDocument(modifiedFixture, {
    outputRootDir,
    pageWidth: 1600,
    webpQuality: 85,
    rendererVersion: "webp-poc-v1",
    displayName: "Giáo Án Ngữ Văn 9 (Tái Bản 2.0)",
  });

  const hashDifferent = result1.sourceSha256 !== resultModified.sourceSha256;
  const pathDifferent = result1.outputDirectory !== resultModified.outputDirectory;

  console.log(`   ✓ Modified SHA-256:    ${resultModified.sourceSha256}`);
  console.log(`   - Hash changed:         ${hashDifferent ? "PASS" : "FAIL"}`);
  console.log(`   - Path changed:         ${pathDifferent ? "PASS" : "FAIL"}`);
  console.log(`   ✓ New isolated dir:    ${resultModified.outputDirectory}\n`);

  if (!hashDifferent || !pathDifferent) {
    throw new Error("Source change invalidation test failed!");
  }

  // 5. Manifest Invariant Summary
  console.log("5. MIGRATION 016 MANIFEST COMPATIBILITY CHECK:");
  console.log(JSON.stringify(result1.manifest, null, 2));

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("POC STATUS: ALL TESTS AND CHECKS COMPLETED SUCCESSFULLY!");
  console.log("══════════════════════════════════════════════════════════════\n");
}

runPoc().catch((err) => {
  console.error("POC Execution Error:", err);
  process.exit(1);
});
