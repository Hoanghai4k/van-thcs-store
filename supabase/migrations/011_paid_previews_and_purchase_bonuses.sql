-- Migration 011: Paid Previews and Purchase Bonuses (Structure Only)
--
-- Redesigns the free preview model into the new commercial model:
--   - Updates products product_type and price constraints to support BONUS
--   - Expands relation_type to support BONUS_INCLUDED
--   - Creates product_previews table for PDF previews
--   - Creates product-previews storage bucket
--   - Creates order_bonus_items to snapshot bonus entitlement at checkout
--
-- IMPORTANT ROLLOUT SAFETY:
-- This migration is strictly structural. It expands the schema to support
-- the new model but DOES NOT migrate existing FREE products to BONUS.
-- Existing FREE/PREVIEW_OF data remains untouched so current application
-- code continues functioning until Phase 6.7B is deployed.
-- Data migration will happen in a future Migration 012.

-- ═══════════════════════════════════════════════════════════════════
-- 1. PRODUCT TYPE AND PRICE CONSTRAINTS
-- ═══════════════════════════════════════════════════════════════════

-- Update product_type constraint to allow BONUS
ALTER TABLE public.products DROP CONSTRAINT products_product_type_check;

ALTER TABLE public.products
ADD CONSTRAINT products_product_type_check
CHECK (product_type IN ('PAID', 'FREE', 'BONUS'));

-- Update price constraint to enforce BONUS price = 0
ALTER TABLE public.products DROP CONSTRAINT products_price_product_type_check;

ALTER TABLE public.products
ADD CONSTRAINT products_price_product_type_check
CHECK (
    (product_type = 'FREE' AND price = 0)
    OR
    (product_type = 'BONUS' AND price = 0)
    OR
    (product_type = 'PAID' AND price > 0)
);

-- ═══════════════════════════════════════════════════════════════════
-- 2. PRODUCT RELATIONS CONSTRAINT
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.product_relations DROP CONSTRAINT product_relations_type_check;

ALTER TABLE public.product_relations
ADD CONSTRAINT product_relations_type_check
CHECK (relation_type IN ('PREVIEW_OF', 'RELATED', 'BONUS_INCLUDED'));

-- ═══════════════════════════════════════════════════════════════════
-- 3. PRODUCT PREVIEWS TABLE
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.product_previews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    product_id uuid NOT NULL UNIQUE
        REFERENCES public.products(id)
        ON DELETE CASCADE,
        
    storage_path text NOT NULL CHECK (storage_path <> ''),
    original_filename text NOT NULL CHECK (original_filename <> ''),
    mime_type text NOT NULL CHECK (mime_type = 'application/pdf'),
    file_size bigint NOT NULL CHECK (file_size > 0),
    page_count integer NOT NULL CHECK (page_count >= 1 AND page_count <= 10),
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uses the existing trigger from 001
CREATE TRIGGER set_product_previews_updated_at
    BEFORE UPDATE ON public.product_previews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.product_previews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_previews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_previews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_previews TO service_role;

-- Policies (Admin only, same pattern as product_files)
CREATE POLICY "product_previews_admin_select"
    ON public.product_previews FOR SELECT TO authenticated
    USING (private.is_admin());

CREATE POLICY "product_previews_admin_insert"
    ON public.product_previews FOR INSERT TO authenticated
    WITH CHECK (private.is_admin());

CREATE POLICY "product_previews_admin_update"
    ON public.product_previews FOR UPDATE TO authenticated
    USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE POLICY "product_previews_admin_delete"
    ON public.product_previews FOR DELETE TO authenticated
    USING (private.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- 4. PRODUCT PREVIEWS STORAGE BUCKET
-- ═══════════════════════════════════════════════════════════════════

-- Explicit INSERT instead of UPSERT to fail fast on unexpected drift
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-previews',
  'product-previews',
  false,
  20971520, -- 20 MiB limit
  ARRAY['application/pdf']
);

-- Storage Policies
CREATE POLICY "product_previews_bucket_admin_select"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'product-previews' AND private.is_admin());

CREATE POLICY "product_previews_bucket_admin_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'product-previews' AND private.is_admin());

CREATE POLICY "product_previews_bucket_admin_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'product-previews' AND private.is_admin())
    WITH CHECK (bucket_id = 'product-previews' AND private.is_admin());

CREATE POLICY "product_previews_bucket_admin_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'product-previews' AND private.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- 5. ORDER BONUS ITEMS TABLE
-- ═══════════════════════════════════════════════════════════════════
-- Freezes bonus entitlement at order creation time.

CREATE TABLE public.order_bonus_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    order_id uuid NOT NULL
        REFERENCES public.orders(id)
        ON DELETE CASCADE,
        
    -- Link back to the specific order item that granted this bonus
    source_order_item_id uuid
        REFERENCES public.order_items(id)
        ON DELETE SET NULL,
    
    -- Link to the source product (to track what granted it)
    source_product_id uuid NOT NULL
        REFERENCES public.products(id)
        ON DELETE RESTRICT,
    
    -- Preserve historical integrity: Do not allow deleting a bonus product
    -- if it's already referenced in a historical order.
    bonus_product_id uuid NOT NULL
        REFERENCES public.products(id)
        ON DELETE RESTRICT,
        
    bonus_name_snapshot text NOT NULL,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Customer only needs one entitlement per bonus per order.
    -- This UNIQUE constraint implicitly creates an index starting with order_id,
    -- eliminating the need for a separate idx_order_bonus_items_order_id index.
    CONSTRAINT order_bonus_items_unique_bonus
        UNIQUE (order_id, bonus_product_id)
);

-- Index for reverse lookups (e.g. Admin audits checking who received a specific bonus)
CREATE INDEX idx_order_bonus_items_bonus_product_id ON public.order_bonus_items(bonus_product_id);

-- RLS
ALTER TABLE public.order_bonus_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.order_bonus_items FROM PUBLIC, anon, authenticated;

-- Admin can SELECT. Server (service_role) needs full CRUD.
GRANT SELECT ON TABLE public.order_bonus_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_bonus_items TO service_role;

CREATE POLICY "order_bonus_items_admin_select"
    ON public.order_bonus_items FOR SELECT TO authenticated
    USING (private.is_admin());

CREATE POLICY "order_bonus_items_service_all"
    ON public.order_bonus_items FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
