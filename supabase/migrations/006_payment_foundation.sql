-- Migration 006: Payment Foundation
--
-- Adds payment_order_code (BIGINT, UNIQUE) to public.orders.
-- payOS requires a numeric orderCode for creating payment links
-- and reconciling payment webhooks.
--
-- Our human-friendly order_code remains the customer-facing reference.
-- payment_order_code is only the provider-facing numeric bridge.
--
-- Migrations 001–005 are immutable and already applied remotely.

ALTER TABLE public.orders
  ADD COLUMN payment_order_code BIGINT UNIQUE;