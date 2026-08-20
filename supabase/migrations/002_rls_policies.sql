-- Migration 002: Row Level Security — Public & Service Policies
--
-- SECURITY DESIGN:
-- - All tables have RLS enabled
-- - Anonymous/authenticated users can only read active categories and products
-- - product_files: NO public access (storage_path is never exposed)
-- - customers, orders, order_items, download_tokens: service_role only
-- - Admin authorization policies are added in migration 004
--
-- NOTE: Service role policies for customers/orders/etc. are kept here
-- because these tables are managed exclusively server-side (checkout,
-- payment webhooks, download generation). They do NOT need admin policies
-- at this milestone — admin product CRUD comes later.

-- ─── Enable RLS on all tables ──────────────────────────────────────

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;

-- ─── Categories ────────────────────────────────────────────────────

-- Public: read active categories only
CREATE POLICY "categories_select_active"
  ON categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ─── Products ──────────────────────────────────────────────────────

-- Public: read active products only
CREATE POLICY "products_select_active"
  ON products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ─── Product Files ─────────────────────────────────────────────────

-- NO public or authenticated access to product_files.
-- Only accessible via service_role (server-side download route)
-- and admin (via is_admin() policies in 004).

-- ─── Customers ─────────────────────────────────────────────────────

-- NO public access. Customer data is managed server-side.

CREATE POLICY "customers_service_only"
  ON customers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Orders ────────────────────────────────────────────────────────

-- NO public access. Orders are created and updated server-side only.

CREATE POLICY "orders_service_only"
  ON orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Order Items ───────────────────────────────────────────────────

CREATE POLICY "order_items_service_only"
  ON order_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Download Tokens ───────────────────────────────────────────────

-- NO public access. Token validation happens server-side.

CREATE POLICY "download_tokens_service_only"
  ON download_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
