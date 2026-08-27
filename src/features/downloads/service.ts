/**
 * Delivery service.
 *
 * Manages secure delivery grants and file downloads.
 *
 * Token flow:
 *   1. ensureDeliveryGrant() — called on PAID webhook or customer recovery
 *   2. validateDeliveryToken() — called on /delivery/[token] entry
 *   3. processDownload() — called on download button click
 *
 * SECURITY:
 * - Raw tokens are only returned on creation, never from DB
 * - Database stores SHA-256 hash only
 * - Downloads use atomic consume_download() RPC to prevent races
 * - Signed URLs are 60 seconds, generated immediately before download
 * - storage_path comes from DB, never from client
 * - Only PAID orders can download
 * - File ownership is verified against order_items
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DeliveryGrant, EnsureDeliveryGrantResult, DeliveryTokenValidation, DownloadResult, PurchasedFile } from "./types";
import { generateDeliveryToken, hashToken, getTokenExpiry, getMaxDownloads, isTokenExpired } from "./token";
import { siteConfig } from "@/config/site";
import { ORDER_STATUS } from "@/lib/constants";
import { getProductFileProvider } from "@/lib/storage/provider";

// ─── Grant Management ──────────────────────────────────────────────

/**
 * Ensure a delivery grant exists for a paid order.
 * If an active (non-revoked) grant already exists, return it.
 * Otherwise, revoke any existing grants and create a new one.
 *
 * @returns The grant and the raw token (only if newly created)
 */
export async function ensureDeliveryGrant(
  orderId: string,
  supabaseAdmin: SupabaseClient<Database>,
): Promise<EnsureDeliveryGrantResult> {
  // Check for existing active grant
  const { data: existing } = await supabaseAdmin
    .from("download_tokens")
    .select("*")
    .eq("order_id", orderId)
    .is("revoked_at", null)
    .single();

  if (existing && !isTokenExpired(existing.expires_at)) {
    return {
      grant: mapDbToGrant(existing),
      rawToken: null, // Cannot recover raw token from hash
      isNew: false,
    };
  }

  // Revoke any existing grants (expired or otherwise)
  await revokeExistingTokens(orderId, supabaseAdmin);

  // Generate new token
  const rawToken = generateDeliveryToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = getTokenExpiry();
  const maxDownloads = getMaxDownloads();

  const { data: newGrant, error } = await supabaseAdmin
    .from("download_tokens")
    .insert({
      order_id: orderId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      max_downloads: maxDownloads,
    })
    .select()
    .single();

  if (error || !newGrant) {
    throw new Error(`Failed to create delivery grant: ${error?.message ?? "unknown error"}`);
  }

  return {
    grant: mapDbToGrant(newGrant),
    rawToken,
    isNew: true,
  };
}

/**
 * Revoke all existing delivery tokens for an order.
 */
export async function revokeExistingTokens(
  orderId: string,
  supabaseAdmin: SupabaseClient<Database>,
): Promise<void> {
  await supabaseAdmin
    .from("download_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .is("revoked_at", null);
}

// ─── Token Validation ──────────────────────────────────────────────

/**
 * Validate a raw delivery token from an email link.
 * Hashes the token and looks it up in the database.
 */
export async function validateDeliveryToken(
  rawToken: string,
  supabaseAdmin: SupabaseClient<Database>,
): Promise<DeliveryTokenValidation> {
  if (!rawToken || rawToken.length < 10) {
    return { valid: false, error: "Token không hợp lệ." };
  }

  const tokenHash = hashToken(rawToken);

  // Lookup by hash
  const { data: grant, error } = await supabaseAdmin
    .from("download_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !grant) {
    return { valid: false, error: "Liên kết nhận tài liệu không hợp lệ hoặc đã hết hạn." };
  }

  // Check revocation
  if (grant.revoked_at) {
    return { valid: false, error: "Liên kết nhận tài liệu không hợp lệ hoặc đã hết hạn." };
  }

  // Check expiration
  if (isTokenExpired(grant.expires_at)) {
    return { valid: false, error: "Liên kết nhận tài liệu không hợp lệ hoặc đã hết hạn." };
  }

  // Check order status
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_code, status")
    .eq("id", grant.order_id)
    .single();

  if (!order || order.status !== ORDER_STATUS.PAID) {
    return { valid: false, error: "Đơn hàng chưa đủ điều kiện tải tài liệu." };
  }

  return {
    valid: true,
    grant: mapDbToGrant(grant),
    orderId: order.id,
    orderCode: order.order_code,
  };
}

/**
 * Get the delivery grant for an order (if active).
 */
export async function getActiveDeliveryGrant(
  orderId: string,
  supabaseAdmin: SupabaseClient<Database>,
): Promise<DeliveryGrant | null> {
  const { data } = await supabaseAdmin
    .from("download_tokens")
    .select("*")
    .eq("order_id", orderId)
    .is("revoked_at", null)
    .single();

  if (!data || isTokenExpired(data.expires_at)) {
    return null;
  }

  return mapDbToGrant(data);
}

// ─── Download Processing ───────────────────────────────────────────

/**
 * Get the list of files a customer can download for a paid order.
 */
export async function getPurchasedFiles(
  orderId: string,
  supabaseAdmin: SupabaseClient<Database>,
): Promise<PurchasedFile[]> {
  // Get order items with product info
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("product_id, product_name")
    .eq("order_id", orderId);

  // Get bonus items
  const { data: bonusItems } = await supabaseAdmin
    .from("order_bonus_items")
    .select("bonus_product_id, bonus_name_snapshot")
    .eq("order_id", orderId);

  if ((!items || items.length === 0) && (!bonusItems || bonusItems.length === 0)) return [];

  const productIds = [
    ...(items || []).map((i) => i.product_id),
    ...(bonusItems || []).map((b) => b.bonus_product_id)
  ];

  // Get product files for all purchased and bonus products
  const { data: files } = await supabaseAdmin
    .from("product_files")
    .select("id, product_id, file_name, file_size")
    .in("product_id", productIds);

  if (!files) return [];

  // Map files with product names
  const productNameMap = new Map([
    ...(items || []).map((i) => [i.product_id, i.product_name] as [string, string]),
    ...(bonusItems || []).map((b) => [b.bonus_product_id, `[QUÀ TẶNG] ${b.bonus_name_snapshot}`] as [string, string])
  ]);

  return files.map((f) => ({
    fileId: f.id,
    productId: f.product_id,
    productName: productNameMap.get(f.product_id) ?? "Tài liệu",
    fileName: f.file_name,
    fileSize: f.file_size,
  }));
}

/**
 * Process a file download request.
 *
 * Validates all conditions, atomically consumes a download count,
 * and generates a short-lived signed URL from the correct provider.
 *
 * Provider-aware: inspects storage_provider on the file row
 * and dispatches to Supabase or R2 accordingly.
 * Entitlement logic is NOT duplicated per provider.
 */
export async function processDownload(
  deliveryGrantId: string,
  orderId: string,
  productFileId: string,
  supabaseAdmin: SupabaseClient<Database>,
): Promise<DownloadResult> {
  // 1. Verify the delivery grant
  const { data: grant } = await supabaseAdmin
    .from("download_tokens")
    .select("id, token_hash, order_id, revoked_at, expires_at, download_count, max_downloads")
    .eq("id", deliveryGrantId)
    .eq("order_id", orderId)
    .is("revoked_at", null)
    .single();

  if (!grant) {
    return { success: false, error: "Phiên tải tài liệu không hợp lệ." };
  }

  if (isTokenExpired(grant.expires_at)) {
    return { success: false, error: "Liên kết nhận tài liệu không hợp lệ hoặc đã hết hạn." };
  }

  if (grant.download_count >= grant.max_downloads) {
    return { success: false, error: "Bạn đã đạt giới hạn tải xuống. Vui lòng liên hệ hỗ trợ." };
  }

  // 2. Verify order is PAID
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== ORDER_STATUS.PAID) {
    return { success: false, error: "Đơn hàng chưa đủ điều kiện tải tài liệu." };
  }

  // 3. Verify file ownership: productFileId → product_id → order_items
  const { data: file } = await supabaseAdmin
    .from("product_files")
    .select("id, product_id, file_name, storage_path, storage_provider")
    .eq("id", productFileId)
    .single();

  if (!file) {
    return { success: false, error: "Tài liệu hiện không khả dụng. Vui lòng liên hệ hỗ trợ." };
  }

  // Verify product belongs to this order
  const { data: orderItem } = await supabaseAdmin
    .from("order_items")
    .select("id")
    .eq("order_id", orderId)
    .eq("product_id", file.product_id)
    .maybeSingle();

  if (!orderItem) {
    const { data: bonusItem } = await supabaseAdmin
      .from("order_bonus_items")
      .select("id")
      .eq("order_id", orderId)
      .eq("bonus_product_id", file.product_id)
      .maybeSingle();

    if (!bonusItem) {
      return { success: false, error: "Tài liệu hiện không khả dụng. Vui lòng liên hệ hỗ trợ." };
    }
  }

  // 4. Atomically consume download count
  const { data: consumed, error: consumeError } = await supabaseAdmin
    .rpc("consume_download", { p_token_hash: grant.token_hash });

  if (consumeError || !consumed || (Array.isArray(consumed) && consumed.length === 0)) {
    return { success: false, error: "Bạn đã đạt giới hạn tải xuống. Vui lòng liên hệ hỗ trợ." };
  }

  // 5. Generate signed URL — provider-aware (storage_path from DB, NEVER from client)
  try {
    const provider = getProductFileProvider(file.storage_provider, supabaseAdmin);
    const signedUrl = await provider.createDownloadUrl(
      file.storage_path,
      siteConfig.store.signedUrlTtlSeconds,
      file.file_name,
    );

    return {
      success: true,
      signedUrl,
      fileName: file.file_name,
    };
  } catch (urlError) {
    console.error("[Download] Signed URL error:", urlError);
    return { success: false, error: "Tài liệu hiện không khả dụng. Vui lòng liên hệ hỗ trợ." };
  }
}

/**
 * Update delivery email state on a grant.
 */
export async function updateDeliveryEmailState(
  grantId: string,
  messageId: string,
  supabaseAdmin: SupabaseClient<Database>,
): Promise<void> {
  await supabaseAdmin
    .from("download_tokens")
    .update({
      delivery_email_sent_at: new Date().toISOString(),
      delivery_email_message_id: messageId,
    })
    .eq("id", grantId);
}

// ─── Helpers ───────────────────────────────────────────────────────

type DbGrant = Database["public"]["Tables"]["download_tokens"]["Row"];

function mapDbToGrant(row: DbGrant): DeliveryGrant {
  return {
    id: row.id,
    orderId: row.order_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    maxDownloads: row.max_downloads,
    downloadCount: row.download_count,
    revokedAt: row.revoked_at,
    deliveryEmailSentAt: row.delivery_email_sent_at,
    deliveryEmailMessageId: row.delivery_email_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
