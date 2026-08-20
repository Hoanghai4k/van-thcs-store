-- Migration 001: Initial Schema
-- Creates all core tables for the Văn THCS Store.
--
-- All product enrichment columns (file_count, page_count, features, etc.)
-- are included from the start — this is the complete foundation schema.

-- Enable UUID extension
-- gen_random_uuid() is provided by pgcrypto, which Supabase enables by default.
-- No extension creation needed.

-- ─── Categories ────────────────────────────────────────────────────
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_is_active ON categories(is_active);

-- ─── Products ──────────────────────────────────────────────────────
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  short_description VARCHAR(500),
  description TEXT,
  price INTEGER NOT NULL CHECK (price >= 0),
  original_price INTEGER CHECK (original_price IS NULL OR original_price >= 0),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  thumbnail_path TEXT,
  preview_images TEXT[],
  file_count INTEGER NOT NULL DEFAULT 1 CHECK (file_count >= 1),
  page_count INTEGER CHECK (page_count IS NULL OR page_count > 0),
  file_format TEXT NOT NULL DEFAULT 'docx',
  features TEXT[],
  suitable_for TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- ─── Product Files ─────────────────────────────────────────────────
CREATE TABLE product_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_files_product_id ON product_files(product_id);

-- ─── Customers ─────────────────────────────────────────────────────
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Normalize email: store lowercase, enforce uniqueness
CREATE UNIQUE INDEX idx_customers_email ON customers(LOWER(email));

-- ─── Orders ────────────────────────────────────────────────────────
CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  payment_method VARCHAR(50),
  payment_transaction_id VARCHAR(255),
  status order_status NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ─── Order Items ───────────────────────────────────────────────────
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- ─── Download Tokens ───────────────────────────────────────────────
CREATE TABLE download_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_downloads INTEGER NOT NULL DEFAULT 5,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_download_at TIMESTAMPTZ
);

CREATE INDEX idx_download_tokens_token ON download_tokens(token);
CREATE INDEX idx_download_tokens_order_id ON download_tokens(order_id);

-- ─── Updated At Trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
