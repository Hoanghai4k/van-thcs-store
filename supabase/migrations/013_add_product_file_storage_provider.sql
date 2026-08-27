-- Migration 013: Add storage provider discriminator to product_files.
--
-- Adds a storage_provider column to identify where each product file
-- is physically stored (Supabase Storage or Cloudflare R2).
--
-- Existing rows default to 'SUPABASE'. New R2 uploads will use 'R2'.
--
-- Migrations 001-012 are immutable.
--
-- REVIEW REQUIRED: This migration must be reviewed by Tech Lead
-- before production push.

-- ============================================================
-- 1. ADD COLUMN
-- ============================================================

ALTER TABLE product_files
  ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'SUPABASE';

-- ============================================================
-- 2. ADD CHECK CONSTRAINT
-- ============================================================

ALTER TABLE product_files
  ADD CONSTRAINT product_files_storage_provider_check
  CHECK (storage_provider IN ('SUPABASE', 'R2'));

-- ============================================================
-- 3. VERIFICATION
-- ============================================================
-- All existing rows now have storage_provider = 'SUPABASE'.
-- No data deletion, no path rewrite, no object migration.
