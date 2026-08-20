-- Migration 007: Secure Digital Delivery
--
-- Replaces the legacy download_tokens table with a hardened,
-- order-level delivery grant model.
--
-- SECURITY:
-- - Raw bearer tokens are NEVER stored.
-- - Only SHA-256 token hashes are persisted.
-- - Downloads are consumed atomically.
-- - Download limits are enforced at database level.
-- - Tokens support expiration and revocation.
-- - Direct client access is prohibited.
--
-- Migrations 001-006 are immutable.

-- ============================================================
-- 1. SAFETY CHECK
-- ============================================================
-- Migration 007 intentionally replaces the legacy table.
-- Abort instead of destroying data if the legacy table
-- unexpectedly contains production rows.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.download_tokens
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Migration 007 aborted: legacy download_tokens contains data';
  END IF;
END
$$;

-- ============================================================
-- 2. REPLACE LEGACY TABLE
-- ============================================================

DROP TABLE public.download_tokens;

CREATE TABLE public.download_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL
    REFERENCES public.orders(id)
    ON DELETE CASCADE,

  token_hash TEXT NOT NULL UNIQUE,

  expires_at TIMESTAMPTZ NOT NULL,

  max_downloads INTEGER NOT NULL DEFAULT 20,

  download_count INTEGER NOT NULL DEFAULT 0,

  revoked_at TIMESTAMPTZ,

  delivery_email_sent_at TIMESTAMPTZ,

  delivery_email_message_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT download_count_positive
    CHECK (download_count >= 0),

  CONSTRAINT max_downloads_positive
    CHECK (max_downloads > 0),

  CONSTRAINT download_count_within_limit
    CHECK (download_count <= max_downloads)
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

-- token_hash UNIQUE already provides its own unique index.
-- No additional token_hash index is necessary.

CREATE INDEX idx_download_tokens_order_id
  ON public.download_tokens(order_id);

-- At most one non-revoked delivery grant per order.
-- Expired grants must be explicitly revoked before rotation.

CREATE UNIQUE INDEX idx_download_tokens_active_order
  ON public.download_tokens(order_id)
  WHERE revoked_at IS NULL;

-- ============================================================
-- 4. ATOMIC DOWNLOAD CONSUMPTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.consume_download(
  p_token_hash TEXT
)
RETURNS TABLE (
  dt_id UUID,
  dt_order_id UUID,
  dt_download_count INTEGER,
  dt_max_downloads INTEGER
)
LANGUAGE SQL
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.download_tokens
  SET
    download_count = download_count + 1,
    updated_at = NOW()
  WHERE token_hash = p_token_hash
    AND revoked_at IS NULL
    AND expires_at > NOW()
    AND download_count < max_downloads
  RETURNING
    id AS dt_id,
    order_id AS dt_order_id,
    download_count AS dt_download_count,
    max_downloads AS dt_max_downloads;
$$;

-- ============================================================
-- 5. FUNCTION PRIVILEGES
-- ============================================================

REVOKE EXECUTE
ON FUNCTION public.consume_download(TEXT)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.consume_download(TEXT)
FROM anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.consume_download(TEXT)
TO service_role;

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.download_tokens
  ENABLE ROW LEVEL SECURITY;

-- Explicitly remove application-role access.

REVOKE ALL
ON TABLE public.download_tokens
FROM anon, authenticated;

-- Server-only access.

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.download_tokens
TO service_role;

CREATE POLICY "download_tokens_service_only"
  ON public.download_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 7. UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER set_download_tokens_updated_at
  BEFORE UPDATE ON public.download_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();