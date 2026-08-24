-- Migration 012: Convert Legacy FREE to BONUS
--
-- This phase permanently converts legacy FREE data into BONUS data.
-- Product types actually allowed: PAID, BONUS (FREE is retired)
-- Relation types actually allowed: RELATED, BONUS_INCLUDED (PREVIEW_OF is retired)

-- ═══════════════════════════════════════════════════════════════════
-- 1. PRE-MIGRATION VALIDATION
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
    malformed_count int;
    collision_count int;
BEGIN
    -- Assert all PREVIEW_OF are FREE source -> PAID target
    SELECT COUNT(*) INTO malformed_count
    FROM public.product_relations pr
    JOIN public.products src ON pr.source_product_id = src.id
    JOIN public.products tgt ON pr.target_product_id = tgt.id
    WHERE pr.relation_type = 'PREVIEW_OF'
      AND (src.product_type != 'FREE' OR tgt.product_type != 'PAID');
      
    IF malformed_count > 0 THEN
        RAISE EXCEPTION 'Pre-migration validation failed: % malformed PREVIEW_OF relations found (expected FREE -> PAID)', malformed_count;
    END IF;

    -- Assert no conversion collisions
    -- When FREE(source) -> PREVIEW_OF -> PAID(target) is converted to PAID(source) -> BONUS_INCLUDED -> BONUS(target)
    -- We must ensure PAID(source) -> BONUS_INCLUDED -> BONUS(target) doesn't already exist
    SELECT COUNT(*) INTO collision_count
    FROM public.product_relations pr_legacy
    WHERE pr_legacy.relation_type = 'PREVIEW_OF'
      AND EXISTS (
          SELECT 1 FROM public.product_relations pr_new
          WHERE pr_new.relation_type = 'BONUS_INCLUDED'
            AND pr_new.source_product_id = pr_legacy.target_product_id
            AND pr_new.target_product_id = pr_legacy.source_product_id
      );

    IF collision_count > 0 THEN
        RAISE EXCEPTION 'Pre-migration validation failed: % conversion collisions detected (edge already exists)', collision_count;
    END IF;

END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. DATA CONVERSION
-- ═══════════════════════════════════════════════════════════════════

-- 2.1 Convert all FREE products to BONUS
UPDATE public.products
SET product_type = 'BONUS'
WHERE product_type = 'FREE';

-- 2.2 Convert all PREVIEW_OF relations to BONUS_INCLUDED
-- and reverse the direction (PAID becomes source, BONUS becomes target)
-- Since we are swapping columns, we do it safely:
UPDATE public.product_relations
SET relation_type = 'BONUS_INCLUDED',
    source_product_id = target_product_id,
    target_product_id = source_product_id
WHERE relation_type = 'PREVIEW_OF';


-- ═══════════════════════════════════════════════════════════════════
-- 3. POST-CONVERSION ASSERTIONS
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
    free_count int;
    preview_of_count int;
    malformed_count int;
BEGIN
    SELECT COUNT(*) INTO free_count FROM public.products WHERE product_type = 'FREE';
    IF free_count > 0 THEN
        RAISE EXCEPTION 'Post-migration assertion failed: % FREE products remain', free_count;
    END IF;

    SELECT COUNT(*) INTO preview_of_count FROM public.product_relations WHERE relation_type = 'PREVIEW_OF';
    IF preview_of_count > 0 THEN
        RAISE EXCEPTION 'Post-migration assertion failed: % PREVIEW_OF relations remain', preview_of_count;
    END IF;

    -- Assert all BONUS_INCLUDED relations are PAID -> BONUS
    SELECT COUNT(*) INTO malformed_count
    FROM public.product_relations pr
    JOIN public.products src ON pr.source_product_id = src.id
    JOIN public.products tgt ON pr.target_product_id = tgt.id
    WHERE pr.relation_type = 'BONUS_INCLUDED'
      AND (src.product_type != 'PAID' OR tgt.product_type != 'BONUS');

    IF malformed_count > 0 THEN
        RAISE EXCEPTION 'Post-migration assertion failed: % malformed BONUS_INCLUDED relations found', malformed_count;
    END IF;

END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. CONSTRAINTS UPDATE
-- ═══════════════════════════════════════════════════════════════════

-- 4.1 Retire FREE from product_type check
ALTER TABLE public.products DROP CONSTRAINT products_product_type_check;

ALTER TABLE public.products
ADD CONSTRAINT products_product_type_check
CHECK (product_type IN ('PAID', 'BONUS'));

-- 4.2 Retire FREE from price rules check
ALTER TABLE public.products DROP CONSTRAINT products_price_product_type_check;

ALTER TABLE public.products
ADD CONSTRAINT products_price_product_type_check
CHECK (
    (product_type = 'BONUS' AND price = 0)
    OR
    (product_type = 'PAID' AND price > 0)
);

-- 4.3 Retire PREVIEW_OF from relation_type check
ALTER TABLE public.product_relations DROP CONSTRAINT product_relations_type_check;

ALTER TABLE public.product_relations
ADD CONSTRAINT product_relations_type_check
CHECK (relation_type IN ('RELATED', 'BONUS_INCLUDED'));
