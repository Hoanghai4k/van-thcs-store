-- Migration 003: Storage Bucket Configuration
--
-- Creates storage buckets for the application.
--
-- BUCKETS:
--   product-files  — PRIVATE. Product documents (.docx). Never publicly accessible.
--   product-assets — PUBLIC.  Thumbnails and preview images.
--
-- Storage policies here use service_role for write access.
-- Migration 004 replaces these with admin-aware policies via is_admin().

-- ─── Product Files Bucket (PRIVATE) ────────────────────────────────
-- Files are accessed via signed URLs generated server-side
-- after download token validation.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-files',
  'product-files',
  false,
  52428800, -- 50 MiB
  ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- ─── Product Assets Bucket (PUBLIC) ────────────────────────────────
-- Thumbnails and preview images. Publicly readable.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-assets',
  'product-assets',
  true,
  10485760, -- 10 MiB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- ─── Storage RLS Policies ──────────────────────────────────────────

-- product-files: only service_role can access (will be replaced by admin policies in 004)
CREATE POLICY "product_files_bucket_service_only"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'product-files')
  WITH CHECK (bucket_id = 'product-files');

-- product-assets: public read
CREATE POLICY "product_assets_bucket_public_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-assets');

-- product-assets: service_role write (will be replaced by admin policies in 004)
CREATE POLICY "product_assets_bucket_service_write"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'product-assets');

CREATE POLICY "product_assets_bucket_service_update"
  ON storage.objects
  FOR UPDATE
  TO service_role
  USING (bucket_id = 'product-assets')
  WITH CHECK (bucket_id = 'product-assets');

CREATE POLICY "product_assets_bucket_service_delete"
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'product-assets');
