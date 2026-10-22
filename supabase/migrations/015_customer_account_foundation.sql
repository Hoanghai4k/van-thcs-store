-- Migration 015: Customer Account Foundation
--
-- Adds the relational database foundation for Customer Accounts:
--   1. Adds nullable auth_user_id to public.customers referencing auth.users(id)
--   2. Enforces 1-to-1 relationship between auth.users and customers via UNIQUE constraint
--   3. Grants minimum necessary SELECT privileges to authenticated role
--   4. Creates customer-scoped Row Level Security (RLS) SELECT policies
--
-- SECURITY & COMPATIBILITY INVARIANTS:
-- - Guest checkout is 100% preserved (customers.auth_user_id is nullable).
-- - ON DELETE SET NULL preserves accounting, invoices, and order history if an auth user is deleted.
-- - No redundant index: PostgreSQL automatically indexes the UNIQUE constraint.
-- - No backfill: Historical guest orders are linked JIT upon verified login.
-- - Read-only customer access: No INSERT/UPDATE/DELETE granted to authenticated.
-- - Admin isolation: Admin authorization and private.is_admin() remain completely untouched.
-- - Legacy My Orders compatibility: Existing /orders and download token flows remain operational.
--
-- Migrations 001–014 are immutable and already applied remotely.

-- ═══════════════════════════════════════════════════════════════════
-- 1. ADD AUTH RELATION TO CUSTOMERS
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.customers
  ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT customers_auth_user_id_unique UNIQUE (auth_user_id);

-- Note: The UNIQUE constraint above automatically creates a unique btree index
-- on customers(auth_user_id). No redundant CREATE INDEX is needed.

-- ═══════════════════════════════════════════════════════════════════
-- 2. TABLE GRANTS (MINIMUM LEAST PRIVILEGE)
-- ═══════════════════════════════════════════════════════════════════
-- In PostgreSQL, RLS policies require underlying table-level SELECT privilege.
-- We grant SELECT only to authenticated users for account and library queries.
-- No INSERT, UPDATE, or DELETE privileges are granted.

GRANT SELECT ON TABLE public.customers TO authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.order_items TO authenticated;
GRANT SELECT ON TABLE public.order_bonus_items TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 3. ROW LEVEL SECURITY POLICIES (AUTHENTICATED CUSTOMER)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 3.1 customers ─────────────────────────────────────────────────
-- Authenticated customer can only view their own linked customer row.

DROP POLICY IF EXISTS "customers_user_self_select" ON public.customers;

CREATE POLICY "customers_user_self_select"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- ─── 3.2 orders ────────────────────────────────────────────────────
-- Authenticated customer can only view orders belonging to their customer row.

DROP POLICY IF EXISTS "orders_user_self_select" ON public.orders;

CREATE POLICY "orders_user_self_select"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id
      FROM public.customers
      WHERE auth_user_id = auth.uid()
    )
  );

-- ─── 3.3 order_items ───────────────────────────────────────────────
-- Authenticated customer can only view line items for their own orders.

DROP POLICY IF EXISTS "order_items_user_self_select" ON public.order_items;

CREATE POLICY "order_items_user_self_select"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id
      FROM public.orders o
      JOIN public.customers c ON o.customer_id = c.id
      WHERE c.auth_user_id = auth.uid()
    )
  );

-- ─── 3.4 order_bonus_items ─────────────────────────────────────────
-- Authenticated customer can only view snapshotted bonus items for their own orders.

DROP POLICY IF EXISTS "order_bonus_items_user_self_select" ON public.order_bonus_items;

CREATE POLICY "order_bonus_items_user_self_select"
  ON public.order_bonus_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id
      FROM public.orders o
      JOIN public.customers c ON o.customer_id = c.id
      WHERE c.auth_user_id = auth.uid()
    )
  );
