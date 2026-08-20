-- Migration 004: Admin Authorization Foundation
--
-- Adds:
--   1. admin_users table (references auth.users)
--   2. Private schema for security-critical helper functions
--   3. private.is_admin() function (SECURITY DEFINER, search_path locked)
--   4. EXECUTE/USAGE privilege lockdown
--   5. Admin-aware RLS policies for categories, products, product_files
--   6. REVOKE all from anon/authenticated, then GRANT minimum
--   7. Storage policy upgrade: replace service_role with admin policies
--   8. Storage bucket enforcement via UPSERT
--
-- SECURITY NOTE: is_admin() lives in the 'private' schema, NOT 'public'.
-- The 'private' schema must NOT be added to Supabase's exposed schemas
-- (API Settings → Data API → Exposed schemas). This ensures the function
-- is never callable via PostgREST/Data API — only via RLS policy evaluation.
--
-- IMPORTANT: This migration does NOT seed any admin user.
-- The first admin must be bootstrapped manually. See docs/development.md.
--
-- After this migration is applied to production, migrations 001–004
-- become IMMUTABLE. All future schema changes must use migration 005+.

-- ═══════════════════════════════════════════════════════════════════
-- 1. ADMIN_USERS TABLE
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- 2. PRIVATE SCHEMA
-- ═══════════════════════════════════════════════════════════════════
-- Security-critical helper functions live here, away from the public
-- schema which is exposed via Supabase Data API / PostgREST.
-- The private schema is NOT exposed through the API.

CREATE SCHEMA IF NOT EXISTS private;

-- Revoke default privileges: no role should access private schema
-- unless explicitly granted.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;

-- authenticated needs USAGE to invoke private.is_admin() in RLS policies.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 3. PRIVATE.IS_ADMIN() FUNCTION
-- ═══════════════════════════════════════════════════════════════════
-- SECURITY DEFINER: runs with function owner privileges,
--   bypassing RLS on admin_users to avoid recursion.
-- STABLE: safe for repeated evaluation in RLS policies.
-- SET search_path = '': prevents search_path hijacking.
-- Always reads auth.uid() — never accepts user_id from client.

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. IS_ADMIN() EXECUTE PRIVILEGE LOCKDOWN
-- ═══════════════════════════════════════════════════════════════════
-- Revoke execute from PUBLIC (which includes anon), then grant
-- only to authenticated (for RLS evaluation) and service_role.

REVOKE EXECUTE ON FUNCTION private.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 5. RLS POLICIES — ADMIN-AWARE
-- ═══════════════════════════════════════════════════════════════════
-- The public active-only SELECT policies from 002 remain untouched.
-- We add admin policies for authenticated users who pass is_admin().

-- ─── categories ────────────────────────────────────────────────────
-- Admin can SELECT all (including inactive), INSERT, UPDATE, DELETE.

CREATE POLICY "categories_admin_select"
  ON categories FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY "categories_admin_insert"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "categories_admin_update"
  ON categories FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE POLICY "categories_admin_delete"
  ON categories FOR DELETE TO authenticated
  USING (private.is_admin());

-- ─── products ──────────────────────────────────────────────────────

CREATE POLICY "products_admin_select"
  ON products FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY "products_admin_insert"
  ON products FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "products_admin_update"
  ON products FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE POLICY "products_admin_delete"
  ON products FOR DELETE TO authenticated
  USING (private.is_admin());

-- ─── product_files ─────────────────────────────────────────────────
-- NO public or general authenticated access.
-- Admin-only via is_admin().

CREATE POLICY "product_files_admin_select"
  ON product_files FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY "product_files_admin_insert"
  ON product_files FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "product_files_admin_update"
  ON product_files FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE POLICY "product_files_admin_delete"
  ON product_files FOR DELETE TO authenticated
  USING (private.is_admin());

-- ─── admin_users ───────────────────────────────────────────────────
-- Self-read only: authenticated user can check if they are admin.
-- NO client INSERT/UPDATE/DELETE — admin bootstrapping is manual SQL.

CREATE POLICY "admin_users_self_read"
  ON admin_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role: full access for manual bootstrap and server operations.
CREATE POLICY "admin_users_service_full"
  ON admin_users FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- 6. GRANTS — REVOKE ALL, THEN GRANT MINIMUM
-- ═══════════════════════════════════════════════════════════════════
-- Explicit least-privilege: revoke everything first, then grant only
-- what each role needs. RLS provides the actual access control.

-- ─── Revoke all from application roles ─────────────────────────────

REVOKE ALL ON TABLE public.categories FROM anon, authenticated;
REVOKE ALL ON TABLE public.products FROM anon, authenticated;
REVOKE ALL ON TABLE public.product_files FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_users FROM anon, authenticated;
REVOKE ALL ON TABLE public.customers FROM anon, authenticated;
REVOKE ALL ON TABLE public.orders FROM anon, authenticated;
REVOKE ALL ON TABLE public.order_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.download_tokens FROM anon, authenticated;

-- ─── Grant minimum ─────────────────────────────────────────────────

-- anon: read-only on public-facing tables (RLS limits to is_active = true)
GRANT SELECT ON categories TO anon;
GRANT SELECT ON products TO anon;

-- authenticated: CRUD on tables where admin RLS decides access
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_files TO authenticated;

-- authenticated: self-check only (RLS limits to own row)
GRANT SELECT ON admin_users TO authenticated;

-- No grants for customers, orders, order_items, download_tokens
-- to anon or authenticated. These are server-only (service_role).

-- ═══════════════════════════════════════════════════════════════════
-- 7. STORAGE POLICY UPGRADE — REPLACE SERVICE_ROLE WITH ADMIN
-- ═══════════════════════════════════════════════════════════════════
-- Drop service_role-only write policies from 003, replace with
-- admin-aware policies using private.is_admin().

-- ─── Drop old service_role policies from 003 ──────────────────────

DROP POLICY IF EXISTS "product_files_bucket_service_only" ON storage.objects;
DROP POLICY IF EXISTS "product_assets_bucket_service_write" ON storage.objects;
DROP POLICY IF EXISTS "product_assets_bucket_service_update" ON storage.objects;
DROP POLICY IF EXISTS "product_assets_bucket_service_delete" ON storage.objects;
-- Keep "product_assets_bucket_public_read" — public read stays

-- ─── product-assets: admin write ───────────────────────────────────

CREATE POLICY "product_assets_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-assets' AND private.is_admin());

CREATE POLICY "product_assets_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-assets' AND private.is_admin())
  WITH CHECK (bucket_id = 'product-assets' AND private.is_admin());

CREATE POLICY "product_assets_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-assets' AND private.is_admin());

-- ─── product-files: admin only, NO public access ──────────────────

CREATE POLICY "product_files_bucket_admin_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-files' AND private.is_admin());

CREATE POLICY "product_files_bucket_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-files' AND private.is_admin());

CREATE POLICY "product_files_bucket_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-files' AND private.is_admin())
  WITH CHECK (bucket_id = 'product-files' AND private.is_admin());

CREATE POLICY "product_files_bucket_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-files' AND private.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- 8. STORAGE BUCKET ENFORCEMENT
-- ═══════════════════════════════════════════════════════════════════
-- Ensure bucket config is correct even if 003 ran first.
-- Uses UPSERT to enforce settings.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-assets',
  'product-assets',
  true,
  10485760, -- 10 MiB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-files',
  'product-files',
  false,
  52428800, -- 50 MiB
  ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
