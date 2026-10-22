-- Migration 016: Document View Artifacts (Full Viewer Database Foundation)
--
-- Adds the relational database foundation for the Secure Full Document Viewer:
--   1. Creates public.document_view_artifacts table to store metadata for derived
--      full-view WebP page renditions stored in private Cloudflare R2.
--   2. Enforces allowed lifecycle statuses, version uniqueness, and READY invariants
--      (transition sequencing is managed by the trusted render worker).
--   3. Enables Row Level Security (RLS) with server-only access (no authenticated grants).
--   4. Reuses the existing update_updated_at_column() trigger function from Migration 001.
--
-- SECURITY & ARCHITECTURAL INVARIANTS:
-- - The viewer will NEVER deliver master DOCX, master ZIP, or complete full PDF to browsers.
-- - Derived artifacts are page-level WebP images stored in private Cloudflare R2.
-- - Browser access model: Authenticated API request -> Customer entitlement check
--   -> Short-lived per-page presigned R2 GET URL -> Browser fetches one page image.
-- - Presigned URLs are short-lived and reusable until expiry (NOT single-use).
-- - Zero exposure of raw storage prefixes or error messages to client-side code.
-- - Generation timing: Asynchronous ingestion upon Admin upload/replacement,
--   shared across all entitled customers.
-- - Redundant product_id is avoided: product_file_id 100% relates to products.
--
-- FUTURE WORKER ZIP SECURITY REQUIREMENTS (DOCUMENTED FOR RENDER WORKER):
-- Any future worker extracting ZIP bundles MUST enforce:
--   1. Path traversal / Zip Slip protection (sanitize all entry paths, reject '..' or root '/')
--   2. Maximum archive size limit (e.g. 200 MB)
--   3. Maximum uncompressed extracted size limit (e.g. 500 MB)
--   4. Maximum entry count limit (e.g. max 100 files per archive)
--   5. Compression ratio / ZIP bomb protection (e.g. reject ratio > 10:1)
--   6. Allowed extension whitelist (extract only .docx, .pdf; ignore executables/scripts)
--   7. No recursive archive extraction (never extract nested zip/tar/gz files)
--   8. Execution timeout (enforce hard processing deadline on extraction)
--   9. Ephemeral temp directory cleanup (guaranteed cleanup on success or error)
--
-- Migrations 001–015 are immutable and already applied remotely.
-- THIS MIGRATION IS AUTHORED LOCALLY — DO NOT APPLY REMOTELY WITHOUT REVIEW.

-- ═══════════════════════════════════════════════════════════════════
-- 1. DOCUMENT VIEW ARTIFACTS TABLE
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.document_view_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign key to source file.
  -- IMPORTANT: The FK cascade deletes ONLY this database artifact metadata row.
  -- It does NOT delete WebP page objects from Cloudflare R2.
  -- Future Admin file management or background cleanup workers must explicitly
  -- issue S3/R2 DeleteObjects requests for obsolete derived/full-view/... prefixes.
  product_file_id UUID NOT NULL
    REFERENCES public.product_files(id)
    ON DELETE CASCADE,
  
  -- Cryptographic hash of the source file for version verification (lowercase 64-char hex)
  source_sha256 TEXT NOT NULL
    CONSTRAINT document_view_artifacts_source_sha256_check
    CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  
  -- Version identifier of the rendering worker / conversion pipeline (non-empty text)
  renderer_version TEXT NOT NULL
    CONSTRAINT document_view_artifacts_renderer_version_check
    CHECK (btrim(renderer_version) <> ''),
  
  -- Lifecycle status of the asynchronous rendering job
  -- Allowed states enforced here; transition sequencing is managed by the render worker
  status TEXT NOT NULL
    CONSTRAINT document_view_artifacts_status_check
    CHECK (status IN (
      'PENDING',
      'PROCESSING',
      'READY',
      'FAILED_RETRYABLE',
      'FAILED_FINAL'
    )),
  
  -- Storage provider for the rendered page assets
  storage_provider TEXT NOT NULL DEFAULT 'R2'
    CONSTRAINT document_view_artifacts_storage_provider_check
    CHECK (storage_provider IN ('R2', 'SUPABASE')),
  
  -- Base storage prefix in R2 (e.g. 'derived/full-view/{productFileId}/{sourceSha256}/{rendererVersion}/')
  -- Nullable while job is PENDING or PROCESSING; mandatory when READY
  storage_prefix TEXT NULL,
  
  -- Total number of rendered pages across all logical sub-documents
  -- Nullable while job is PENDING or PROCESSING; mandatory positive integer when READY
  page_count INTEGER NULL
    CONSTRAINT document_view_artifacts_page_count_check
    CHECK (page_count IS NULL OR page_count >= 1),
  
  -- Array of logical documents inside one source file (single DOCX/PDF or multi-document ZIP)
  -- Example: [{"key": "doc-0001", "name": "Tên tài liệu", "pageCount": 120}]
  document_manifest JSONB NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT document_view_artifacts_document_manifest_array_check
    CHECK (jsonb_typeof(document_manifest) = 'array'),
  
  -- Optional machine-readable error code if rendering fails
  error_code TEXT NULL,
  
  -- Optional human-readable or debug error message if rendering fails
  error_message TEXT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 1 canonical rendition version per (product_file_id, source_sha256, renderer_version).
  -- Note: PostgreSQL automatically creates a unique btree index for this constraint.
  -- As product_file_id is the leading column, no redundant standalone index is needed.
  CONSTRAINT document_view_artifacts_version_unique
    UNIQUE (product_file_id, source_sha256, renderer_version),

  -- READY state invariant:
  -- A READY artifact MUST satisfy all of the following:
  -- 1. storage_prefix IS NOT NULL AND btrim(storage_prefix) <> ''
  -- 2. page_count IS NOT NULL AND page_count >= 1
  -- 3. jsonb_typeof(document_manifest) = 'array' AND jsonb_array_length(document_manifest) >= 1
  -- 4. error_code IS NULL
  -- 5. error_message IS NULL
  -- Non-READY states may contain partial rendering metadata or error information.
  CONSTRAINT document_view_artifacts_ready_check
    CHECK (
      status <> 'READY'
      OR (
        storage_prefix IS NOT NULL
        AND btrim(storage_prefix) <> ''
        AND page_count IS NOT NULL
        AND page_count >= 1
        AND (
          CASE
            WHEN jsonb_typeof(document_manifest) = 'array'
            THEN jsonb_array_length(document_manifest) >= 1
            ELSE FALSE
          END
        )
        AND error_code IS NULL
        AND error_message IS NULL
      )
    )
);

-- Index on status for worker job polling and operational monitoring
CREATE INDEX idx_document_view_artifacts_status
  ON public.document_view_artifacts(status);

-- ═══════════════════════════════════════════════════════════════════
-- 2. UPDATED_AT TRIGGER
-- ═══════════════════════════════════════════════════════════════════
-- Reuses the established update_updated_at_column() function from Migration 001.

CREATE TRIGGER set_document_view_artifacts_updated_at
  BEFORE UPDATE ON public.document_view_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- 3. ROW LEVEL SECURITY & PERMISSIONS (SERVER-ONLY ACCESS)
-- ═══════════════════════════════════════════════════════════════════
-- Architectural Decision:
-- Customers must NOT directly query or mutate document_view_artifacts.
-- Raw storage prefixes, error messages, and hashes are internal infrastructure details.
--
-- Access Chain:
-- 1. Browser calls authenticated viewer API: GET /api/account/library/[productId]/...
-- 2. Route checks Customer Supabase Auth session & verifies entitlement via RLS queries.
-- 3. Once entitlement is verified, the server uses service_role (getSupabaseAdmin)
--    to read artifact metadata and issue short-lived per-page presigned R2 URLs.
-- 4. No SELECT, INSERT, UPDATE, or DELETE is granted to authenticated or anon roles.

ALTER TABLE public.document_view_artifacts ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke all privileges from public, anon, and authenticated
REVOKE ALL ON TABLE public.document_view_artifacts FROM PUBLIC, anon, authenticated;

-- Grant full table permissions exclusively to service_role for backend operations
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_view_artifacts TO service_role;
