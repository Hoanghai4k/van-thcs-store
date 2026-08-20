-- Migration 005: Allow draft products to have zero attached files
--
-- Draft products may exist before any .docx file is uploaded.
-- file_count represents the actual number of rows in product_files.
--
-- Business rule:
--   draft + 0 files  = allowed
--   active + 0 files = blocked by application/server logic

-- 1. New products should start with zero attached files
ALTER TABLE public.products
  ALTER COLUMN file_count SET DEFAULT 0;

-- 2. Remove previous file_count constraints.
-- Both names are included because earlier migration versions
-- may have used either constraint name.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_file_count_check;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_file_count;

-- 3. Synchronize existing product file counts with the real
-- number of product_files rows.
UPDATE public.products AS p
SET file_count = (
  SELECT COUNT(*)::integer
  FROM public.product_files AS pf
  WHERE pf.product_id = p.id
);

-- 4. file_count may be zero, but never negative.
ALTER TABLE public.products
  ADD CONSTRAINT products_file_count_check
  CHECK (file_count >= 0);