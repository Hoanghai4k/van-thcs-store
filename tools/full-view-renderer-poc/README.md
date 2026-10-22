# Full View Renderer Local PoC (Phase 2D)
Site A — Tài Liệu Hằng Cao

## Overview
This isolated proof-of-concept tool validates that arbitrary PDF documents can be deterministically transformed into high-resolution page-level WebP images and metadata manifests matching the invariants of Migration 016 (`public.document_view_artifacts`).

## Key Invariants
- **Source Privacy**: The browser NEVER receives the master DOCX, ZIP, or full downloadable PDF.
- **Derived Page Assets**: Rasterized page images (`doc-0001/page-0001.webp`, etc.).
- **Deterministic Versioning**: Output directory structured strictly by `{sourceSha256}/{rendererVersion}/`.
- **Manifest Validation**: JSON array matching `document_manifest` schema where `sum(manifest[*].pageCount) === pageCount`.
- **Zero Production Mutations**: No writes to production PostgreSQL or Cloudflare R2 storage.

## Architecture
- **PDF Engine**: Mozilla `pdfjs-dist` (pure Node.js).
- **Canvas / Rasterizer**: `@napi-rs/canvas` (hardware-accelerated, native WebP encoder).
- **DOCX Adapter**: Clean interface for headless LibreOffice conversion if installed; cleanly reports `DOCX RUNTIME BLOCKED LOCALLY` otherwise.

## Running the PoC
```bash
# Generate synthetic Vietnamese lesson fixture
npx tsx fixtures/generate-fixtures.ts

# Execute rendering pipeline & determinism checks
npx tsx src/cli.ts

# Run isolated PoC tests
npx vitest run tests/poc.test.ts
```
