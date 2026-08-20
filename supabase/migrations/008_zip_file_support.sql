-- Migration 008: ZIP File Support
--
-- Adds ZIP MIME types to the existing product-files bucket.
-- The bucket MUST remain PRIVATE.
-- No application table schema changes.
--
-- Migrations 001-007 are immutable.

-- ============================================================
-- 1. SAFETY CHECK
-- ============================================================

DO $$
DECLARE
  bucket_is_public BOOLEAN;
BEGIN
  SELECT public
  INTO bucket_is_public
  FROM storage.buckets
  WHERE id = 'product-files';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Migration 008 aborted: product-files bucket does not exist';
  END IF;

  IF bucket_is_public THEN
    RAISE EXCEPTION
      'Migration 008 aborted: product-files bucket must remain private';
  END IF;
END
$$;

-- ============================================================
-- 2. ALLOW DOCX + ZIP
-- ============================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed'
]::text[]
WHERE id = 'product-files';