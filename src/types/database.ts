/**
 * Database types — re-exports from auto-generated Supabase types.
 *
 * Generated via: npx supabase gen types --lang typescript --linked
 * Source of truth: src/types/supabase.ts
 *
 * DO NOT manually edit supabase.ts — re-generate it after schema changes.
 * This file provides friendly aliases used throughout the application.
 */

export type { Database } from "./supabase";
export type { Tables, TablesInsert, TablesUpdate, Enums } from "./supabase";

// ─── Friendly aliases ──────────────────────────────────────────────
// These keep existing imports working without changes.

import type { Tables, TablesInsert, TablesUpdate } from "./supabase";

// Row types (read)
export type DbCategory = Tables<"categories">;
export type DbProduct = Tables<"products">;
export type DbProductFile = Tables<"product_files">;
export type DbAdminUser = Tables<"admin_users">;
export type DbCustomer = Tables<"customers">;
export type DbOrder = Tables<"orders">;
export type DbOrderItem = Tables<"order_items">;
export type DbDownloadToken = Tables<"download_tokens">;
export type DbPaymentAttempt = Tables<"payment_attempts">;

// Insert types
export type DbCategoryInsert = TablesInsert<"categories">;
export type DbProductInsert = TablesInsert<"products">;
export type DbProductFileInsert = TablesInsert<"product_files">;
export type DbCustomerInsert = TablesInsert<"customers">;
export type DbOrderInsert = TablesInsert<"orders">;
export type DbOrderItemInsert = TablesInsert<"order_items">;
export type DbPaymentAttemptInsert = TablesInsert<"payment_attempts">;

// Update types
export type DbCategoryUpdate = TablesUpdate<"categories">;
export type DbProductUpdate = TablesUpdate<"products">;
export type DbOrderUpdate = TablesUpdate<"orders">;
export type DbPaymentAttemptUpdate = TablesUpdate<"payment_attempts">;
