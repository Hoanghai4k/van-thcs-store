# Full-View Renderer & Orchestrator Worker Package (`@van-thcs/full-view-renderer`)

Production-oriented, isolated document rasterization and storage lifecycle orchestration package for **Tài Liệu Hằng Cao** (Site A).

Converts private master document files (PDF/DOCX) into deterministic page-level WebP renditions and coordinates remote derived object storage and database status lifecycle compatible with **Database Migration 016** (`public.document_view_artifacts`).

---

## 1. Architectural Boundaries & Isolation

```
[Private Master Source File]
              │
              ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  workers/full-view-renderer                                  │
   │  (Isolated Node.js Process / Container)                      │
   │                                                              │
   │  1. Authoritative SHA-256 Byte Calculation                   │
   │  2. Artifact State Machine (PENDING -> PROCESSING -> READY)  │
   │  3. Preflight Security & Resource Bounds Check               │
   │  4. Safe DOCX -> Intermediate PDF Adapter (LibreOffice)      │
   │  5. Bounded Concurrency Rasterization (1-2w)                 │
   │  6. Atomic Local Staging Promotion                           │
   │  7. Deterministic POSIX Object Planning                      │
   │  8. Abstract Derived Object Upload (Cloudflare R2)           │
   │  9. Upload Verification Before markReady()                   │
   │  10. Controlled Failure Classification & Storage Cleanup     │
   └──────────────────────────────────────────────────────────────┘
              │
              ▼
   [Private Cloudflare R2 Bucket + Supabase DB Record]
```

### Complete Separation from Next.js Runtime
- **No Native Dependencies in Next.js Root**: Native packages (`@napi-rs/canvas`, `pdfjs-dist`) are strictly confined to `workers/full-view-renderer`.
- **No Database / Cloud Secrets in Worker Core**: Worker relies on dependency injection via `ArtifactRepository` and `DerivedStorage` interfaces.
- **Service Role Boundary**: The production repository implementation uses `service_role` exclusively within trusted server-side worker containers. Never expose `service_role` or repository methods to client components or viewer frontends.

---

## 2. Deterministic Layout & Migration 016 Compatibility

Artifacts are planned and stored in a deterministic layout:
```
derived/full-view/
  {productFileId}/
    {sourceSha256}/
      {rendererVersion}/
        doc-0001/
          page-0001.webp
          page-0002.webp
          ...
          page-0030.webp
        manifest.json
```

### Naming Invariants
- **Storage Prefix**: `derived/full-view/{productFileId}/{sourceSha256}/{rendererVersion}/`
- **POSIX Keys**: Strict forward slashes (`/`), no leading slash, no backslashes, no traversal (`..`).
- **Document subfolder**: `doc-0001` (4-digit zero-padded)
- **Pages**: `page-0001.webp` (1-based, 4-digit zero-padded)
- **Boundary**: Page counts exceeding 9,999 throw `PAGE_COUNT_EXCEEDS_NAMING_LIMIT` to avoid ambiguous filenames.

---

## 3. Resource Guards & Safety Limits

All defaults are initial conservative engineering limits to protect memory and CPU:

| Parameter | Default | Description |
|---|---|---|
| `maxSourceBytes` | `100 MiB` | Guards against decompression bombs or excessive source files |
| `maxPdfPages` | `1,000` | **Hard rejection ceiling only**. Does NOT imply 1,000 pages will finish in 2 min. Real operational limit should be calibrated with real documents. |
| `maxPageNumber` | `9,999` | 4-digit filename zero-padding boundary |
| `defaultPageWidth` | `1600 px` | High-DPI target rendition width (min 400, max 4096) |
| `defaultWebpQuality` | `85` | Balanced quality-to-filesize ratio (1-100) |
| `maxRenderPixelsPerPage` | `16 MP` | Canvas memory guard against malicious gigantic viewports |
| `defaultConcurrency` | `2` | Bounded concurrent page rendering (strict memory protection) |
| `defaultRenderTimeoutMs` | `120,000 ms` | Overall render timeout watchdog |

---

## 4. R2 Upload Strategy & The "markReady" Invariant

### R2 Has No Atomic Directory Rename
Because S3/Cloudflare R2 is an object store without POSIX filesystem directory renames, atomic promotion cannot be achieved via renaming.

### Production Upload Pipeline
1. Render locally into staging directory.
2. Plan deterministic POSIX object keys (`planDerivedObjects`).
3. Upload all page WebP images and `manifest.json`.
4. **Strict Verification**: Probe `objectExists()` for every planned object.
5. **markReady Invariant**: `markReady()` is **NEVER** called until every single object is verified in storage.
6. If upload or verification fails:
   - Status transitions to `FAILED_RETRYABLE`.
   - Cleanup is executed immediately (`deletePrefix`).
   - Cleanup failure is reported separately and does NOT mask the primary upload error.

---

## 5. Artifact State Machine & Idempotency

Migration 016 defines 5 states: `PENDING`, `PROCESSING`, `READY`, `FAILED_RETRYABLE`, `FAILED_FINAL`.

### Idempotency Rules:
- **Same `(product_file_id, source_sha256, renderer_version)` is `READY`**:
  - Immediately skipped without re-rendering or re-uploading.
- **Artifact is `PROCESSING`**:
  - Concurrent invocation is rejected to prevent duplicate work.
- **Artifact is `FAILED_RETRYABLE`**:
  - Automatically permitted to re-attempt processing.
- **Artifact is `FAILED_FINAL`**:
  - Blocked from automatic retry unless `forceRetry: true` is explicitly provided.
- **Source replacement** (new SHA-256 for same `product_file_id`):
  - Creates a new version row. Old version remains `READY` and untouched for rollback safety.
- **Renderer version upgrade** (e.g. `webp-prod-v1` to `webp-prod-v2`):
  - Creates a new version row. Both versions coexist peacefully.

---

## 6. Concurrency Risk & Recommended Production Locking

### Current Race Condition
If two worker instances (Worker A and Worker B) observe a `PENDING` artifact simultaneously:
- Both may attempt local rendering and R2 uploading concurrently.

### Recommended Production Lock Mechanisms
1. **PostgreSQL Advisory Locks**:
   ```sql
   SELECT pg_try_advisory_xact_lock(hashtext(product_file_id || ':' || source_sha256 || ':' || renderer_version));
   ```
2. **Conditional Atomic State Transition**:
   ```sql
   UPDATE public.document_view_artifacts
   SET status = 'PROCESSING', updated_at = now()
   WHERE id = :id AND status IN ('PENDING', 'FAILED_RETRYABLE')
   RETURNING *;
   ```
   If 0 rows returned, another worker has claimed the task.
3. **Dedicated Job Queue**:
   Use BullMQ or Cloudflare Queues with a unique job ID: `${productFileId}:${sourceSha256}:${rendererVersion}`.

---

## 7. Performance & Catalog Reality Note

The synthetic 30-page test benchmark:
- ~6.8 KB / page WebP (205 KB total for 30 pages)
- ~100–160 ms / page rasterization duration

> [!WARNING]
> **NON-REPRESENTATIVE BENCHMARK**:
> Real Vietnamese educational lesson plans, exam sheets, and scanned PDFs contain color graphics, high-resolution diagrams, complex vector fonts, and shaded backgrounds.
> Real-world page sizes will frequently range from **50 KB to 250 KB per page** at 1600px width.
> Do NOT use the synthetic 6.8 KB value for production R2 storage cost forecasting.

---

## 8. Runtime & Environment Pinning

- **Production Container Target**: **Node.js 22 LTS** (`node:22-bookworm-slim`).
- **Engines Declaration**: `"node": ">=22.0.0"`.
- **Development Runtime**: Evaluated and passing under Node `v24.11.0`.
- **Root Next.js Application**: Node 22/24 (`@types/node: ^22.15.0`), completely unchanged.
