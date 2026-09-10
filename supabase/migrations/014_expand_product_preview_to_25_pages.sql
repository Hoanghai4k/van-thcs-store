-- Migration 014: Expand product_previews page_count limit from 10 to 25
--
-- Business decision: Increase the maximum preview length from 10 pages
-- to 25 pages. This migration ONLY modifies the CHECK constraint on
-- public.product_previews.page_count.
--
-- SECURITY INVARIANT:
-- The derived preview PDF itself must contain no more than 25 pages.
-- Application code continues to enforce 10-page slicing until Phase 7.2B.
--
-- SCOPE:
-- - Drops the existing page_count CHECK constraint (product_previews_page_count_check)
-- - Adds a new CHECK constraint allowing page_count in [1, 25]
-- - NO data modifications, NO table recreation, NO column type changes
-- - NO changes to product_files, storage buckets, RLS, or business logic

-- ═══════════════════════════════════════════════════════════════════
-- 1. PRE-FLIGHT VALIDATION
-- ═══════════════════════════════════════════════════════════════════
-- Verify no existing rows violate the target range 1..25.
-- Under the old 1..10 rule this should be impossible, but we keep
-- migration behavior explicit and deterministic.

DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT COUNT(*)
    INTO invalid_count
    FROM public.product_previews
   WHERE page_count < 1
      OR page_count > 25;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      'MIGRATION 014 BLOCKED: Found % product_previews row(s) with page_count outside [1, 25]. '
      'Inspect and fix manually before retrying.',
      invalid_count;
  END IF;
END
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. REPLACE page_count CHECK CONSTRAINT
-- ═══════════════════════════════════════════════════════════════════

-- Drop the existing inline CHECK (auto-named by PostgreSQL)
ALTER TABLE public.product_previews
  DROP CONSTRAINT product_previews_page_count_check;

-- Add the expanded CHECK with an explicit, descriptive name
ALTER TABLE public.product_previews
  ADD CONSTRAINT product_previews_page_count_check
  CHECK (page_count >= 1 AND page_count <= 25);
