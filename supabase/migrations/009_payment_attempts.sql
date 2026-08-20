-- Migration 009: Payment Attempts
-- Enables safe payment retries by separating payment attempts from the core order.
-- Currently, orders.payment_order_code limits an order to a single payOS checkout link.
-- When a link expires or is cancelled, creating a new link requires a new attempt row.

CREATE TABLE public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  provider VARCHAR(50) NOT NULL DEFAULT 'payos',
  provider_order_code BIGINT NOT NULL,
  provider_payment_link_id VARCHAR(255),
  checkout_url TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  UNIQUE (provider, provider_order_code),
  CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Partial index ensuring at most one active attempt per order per provider
CREATE UNIQUE INDEX idx_payment_attempts_active_unique 
ON public.payment_attempts (order_id, provider)
WHERE status IN ('PENDING', 'PROCESSING');

-- Unique provider payment link ID
CREATE UNIQUE INDEX idx_payment_attempts_link_id_unique
ON public.payment_attempts (provider, provider_payment_link_id)
WHERE provider_payment_link_id IS NOT NULL;

-- General Indexes
CREATE INDEX idx_payment_attempts_order_id ON public.payment_attempts(order_id);
CREATE INDEX idx_payment_attempts_status ON public.payment_attempts(status);

-- Updated_at trigger
CREATE TRIGGER set_payment_attempts_updated_at
  BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security: Server-only (service_role)
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_attempts TO service_role;

-- Legacy metadata on `orders` is kept intact to allow a gradual migration.
-- Application code must fallback to `orders.payment_order_code` for legacy webhooks.
