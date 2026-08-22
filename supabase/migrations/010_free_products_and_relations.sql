-- Migration 010: Free preview products + related paid products
-- Reconstructed from the migration statements already applied on the remote Supabase project.
-- IMPORTANT: Migration 010 is already applied remotely and must be treated as immutable.

-- 1. Product type
ALTER TABLE public.products
ADD COLUMN product_type text NOT NULL DEFAULT 'PAID';

ALTER TABLE public.products
ADD CONSTRAINT products_product_type_check
CHECK (product_type IN ('PAID', 'FREE'));

ALTER TABLE public.products
ADD CONSTRAINT products_price_product_type_check
CHECK (
    (product_type = 'FREE' AND price = 0)
    OR
    (product_type = 'PAID' AND price > 0)
);

-- 2. Product relations
CREATE TABLE public.product_relations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    source_product_id uuid NOT NULL
        REFERENCES public.products(id)
        ON DELETE CASCADE,

    target_product_id uuid NOT NULL
        REFERENCES public.products(id)
        ON DELETE CASCADE,

    relation_type text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT product_relations_type_check
        CHECK (relation_type IN ('PREVIEW_OF', 'RELATED')),

    CONSTRAINT product_relations_no_self_reference
        CHECK (source_product_id <> target_product_id),

    CONSTRAINT product_relations_unique_edge
        UNIQUE (source_product_id, target_product_id, relation_type),

    CONSTRAINT product_relations_sort_order_check
        CHECK (sort_order >= 0)
);

CREATE INDEX idx_product_relations_target
ON public.product_relations (target_product_id);

-- 3. Row Level Security and explicit privileges
ALTER TABLE public.product_relations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_relations
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON TABLE public.product_relations
TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.product_relations
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.product_relations
TO service_role;

-- 4. RLS policies
CREATE POLICY "product_relations_public_select"
ON public.product_relations
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.products AS source_product
        WHERE source_product.id = product_relations.source_product_id
          AND source_product.is_active = true
    )
    AND
    EXISTS (
        SELECT 1
        FROM public.products AS target_product
        WHERE target_product.id = product_relations.target_product_id
          AND target_product.is_active = true
    )
);

CREATE POLICY "product_relations_admin_select"
ON public.product_relations
FOR SELECT
TO authenticated
USING (private.is_admin());

CREATE POLICY "product_relations_admin_insert"
ON public.product_relations
FOR INSERT
TO authenticated
WITH CHECK (private.is_admin());

CREATE POLICY "product_relations_admin_update"
ON public.product_relations
FOR UPDATE
TO authenticated
USING (private.is_admin())
WITH CHECK (private.is_admin());

CREATE POLICY "product_relations_admin_delete"
ON public.product_relations
FOR DELETE
TO authenticated
USING (private.is_admin());