/**
 * Customer Account Library Queries.
 *
 * Derives digital library entitlements strictly from server-side order state:
 * - Primary purchases: public.orders (status = 'PAID') + public.order_items
 * - BONUS gifts: public.orders (status = 'PAID') + public.order_bonus_items
 *
 * STRICT SECURITY CONSTRAINTS:
 * - NO getSupabaseAdmin() — reads use authenticated SSR client only, enforcing RLS.
 * - Identity chain: Supabase Auth session -> auth.uid() -> customers.auth_user_id -> orders.
 * - Deduplication: Multiple acquisitions of the same product render 1 card,
 *   preferring PAID over BONUS and selecting the earliest valid acquisition date.
 * - NEVER exposes master storage paths, R2 keys, or full file download URLs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type LibraryAcquisitionType = "PAID" | "BONUS";

export interface LibraryItem {
  productId: string;
  slug: string | null;
  name: string;
  thumbnailUrl: string | null;
  shortDescription: string | null;
  productType: string | null;
  isActive: boolean;
  acquisitionType: LibraryAcquisitionType;
  acquiredAt: string; // ISO date string
  orderCode: string;
}

interface OrderMeta {
  orderCode: string;
  acquiredAt: string;
}

/**
 * Retrieve all entitled library items for the currently authenticated customer.
 * Uses authenticated SSR client enforcing Row Level Security.
 */
export async function getCustomerLibrary(
  client?: SupabaseClient<Database>,
): Promise<LibraryItem[]> {
  const supabase = client ?? (await getSupabaseServerClient());

  // 1. Fetch own PAID orders only
  // RLS on orders enforces: customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  const { data: paidOrders, error: ordersError } = await supabase
    .from("orders")
    .select("id, order_code, paid_at, created_at, status")
    .eq("status", "PAID");

  if (ordersError || !paidOrders || paidOrders.length === 0) {
    return [];
  }

  const orderMap = new Map<string, OrderMeta>();
  const paidOrderIds: string[] = [];

  for (const order of paidOrders) {
    paidOrderIds.push(order.id);
    const acquiredAt = order.paid_at || order.created_at;
    orderMap.set(order.id, {
      orderCode: order.order_code,
      acquiredAt,
    });
  }

  // 2. Concurrently fetch order_items and order_bonus_items for these PAID orders
  const [itemsRes, bonusRes] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, order_id, product_id, product_name, created_at")
      .in("order_id", paidOrderIds),
    supabase
      .from("order_bonus_items")
      .select("id, order_id, bonus_product_id, bonus_name_snapshot, created_at")
      .in("order_id", paidOrderIds),
  ]);

  const orderItems = itemsRes.data || [];
  const bonusItems = bonusRes.data || [];

  // 3. Gather all distinct product IDs across items and bonus items
  const allProductIds = new Set<string>();
  for (const item of orderItems) {
    if (item.product_id) allProductIds.add(item.product_id);
  }
  for (const bonus of bonusItems) {
    if (bonus.bonus_product_id) allProductIds.add(bonus.bonus_product_id);
  }

  if (allProductIds.size === 0) {
    return [];
  }

  // 4. Batch resolve current product metadata for thumbnails, slugs, and status
  const { data: productsData } = await supabase
    .from("products")
    .select("id, name, slug, thumbnail_path, short_description, product_type, is_active")
    .in("id", Array.from(allProductIds));

  const productsMap = new Map<
    string,
    {
      id: string;
      name: string;
      slug: string;
      thumbnail_path: string | null;
      short_description: string | null;
      product_type: string;
      is_active: boolean;
    }
  >();

  if (productsData) {
    for (const prod of productsData) {
      productsMap.set(prod.id, prod);
    }
  }

  // 5. Deduplicate by unique productId and determine acquisition source & earliest date
  const libraryItems: LibraryItem[] = [];

  for (const productId of allProductIds) {
    // All primary purchases for this product
    const paidPurchases = orderItems
      .filter((item) => item.product_id === productId)
      .map((item) => {
        const order = orderMap.get(item.order_id);
        return {
          type: "PAID" as const,
          acquiredAt: order?.acquiredAt || item.created_at,
          orderCode: order?.orderCode || "",
          snapshotName: item.product_name,
        };
      });

    // All bonus acquisitions for this product
    const bonusPurchases = bonusItems
      .filter((b) => b.bonus_product_id === productId)
      .map((b) => {
        const order = orderMap.get(b.order_id);
        return {
          type: "BONUS" as const,
          acquiredAt: order?.acquiredAt || b.created_at,
          orderCode: order?.orderCode || "",
          snapshotName: b.bonus_name_snapshot,
        };
      });

    let acquisitionType: LibraryAcquisitionType;
    let earliestAcquiredAt: string;
    let chosenOrderCode: string;
    let fallbackName: string;

    if (paidPurchases.length > 0) {
      // RULE: PAID overrides BONUS as primary display source
      acquisitionType = "PAID";
      // Sort ascending to find earliest valid purchase date
      paidPurchases.sort(
        (a, b) => new Date(a.acquiredAt).getTime() - new Date(b.acquiredAt).getTime(),
      );
      earliestAcquiredAt = paidPurchases[0].acquiredAt;
      chosenOrderCode = paidPurchases[0].orderCode;
      fallbackName = paidPurchases[0].snapshotName;
    } else if (bonusPurchases.length > 0) {
      acquisitionType = "BONUS";
      bonusPurchases.sort(
        (a, b) => new Date(a.acquiredAt).getTime() - new Date(b.acquiredAt).getTime(),
      );
      earliestAcquiredAt = bonusPurchases[0].acquiredAt;
      chosenOrderCode = bonusPurchases[0].orderCode;
      fallbackName = bonusPurchases[0].snapshotName;
    } else {
      continue;
    }

    const liveProduct = productsMap.get(productId);
    const name = liveProduct?.name || fallbackName;
    const slug = liveProduct?.slug || null;
    const thumbnailUrl = liveProduct?.thumbnail_path || null;
    const shortDescription = liveProduct?.short_description || null;
    const productType = liveProduct?.product_type || (acquisitionType === "BONUS" ? "BONUS" : "STANDARD");
    const isActive = liveProduct ? liveProduct.is_active : false;

    libraryItems.push({
      productId,
      slug,
      name,
      thumbnailUrl,
      shortDescription,
      productType,
      isActive,
      acquisitionType,
      acquiredAt: earliestAcquiredAt,
      orderCode: chosenOrderCode,
    });
  }

  // 6. Sort library items descending by acquiredAt (newest acquisitions first)
  libraryItems.sort(
    (a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime(),
  );

  return libraryItems;
}

/**
 * Quick count of customer's entitled library items.
 */
export async function getCustomerLibraryCount(
  client?: SupabaseClient<Database>,
): Promise<number> {
  const items = await getCustomerLibrary(client);
  return items.length;
}
