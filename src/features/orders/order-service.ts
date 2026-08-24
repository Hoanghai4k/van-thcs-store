/**
 * Order Service.
 *
 * Core business logic for creating checkout orders.
 * All prices are calculated server-side from the database.
 * Client-provided prices are NEVER trusted.
 *
 * Uses Supabase admin client (service_role) for all DB operations,
 * since customers/orders/order_items are RLS-protected (service_role only).
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateOrderCode, generatePaymentOrderCode, normalizeEmail } from "@/lib/utils";
import type { DbProduct } from "@/types/database";

// ─── Types ─────────────────────────────────────────────────────────

export interface CheckoutInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productIds: string[];
}

export interface CreatedOrder {
  orderId: string;
  orderCode: string;
  paymentOrderCode: number;
  customerId: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  items: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
  }>;
}

// ─── Main Service ──────────────────────────────────────────────────

/**
 * Create a checkout order with server-trusted pricing.
 *
 * Flow:
 * 1. Validate + deduplicate product IDs
 * 2. Fetch products from DB (active only)
 * 3. Calculate totals from DB prices
 * 4. Find or create customer
 * 5. Generate unique order code + payment order code
 * 6. Insert order + order_items
 * 7. Return order data for payment
 *
 * If order_items insert fails, the order is rolled back via deletion.
 */
export async function createCheckoutOrder(
  input: CheckoutInput,
): Promise<CreatedOrder> {
  const supabase = getSupabaseAdmin();

  // 1. Deduplicate product IDs (digital products: qty = 1, no dupes)
  const uniqueProductIds = [...new Set(input.productIds)];
  if (uniqueProductIds.length === 0) {
    throw new CheckoutError("Giỏ hàng không được rỗng.");
  }

  // 2. Fetch products from DB — only active ones
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, is_active, product_type")
    .in("id", uniqueProductIds);

  if (productsError) {
    console.error("[OrderService] Product fetch error:", productsError.message);
    throw new CheckoutError("Không thể tạo đơn hàng. Vui lòng thử lại.");
  }

  if (!products || products.length === 0) {
    throw new CheckoutError("Không tìm thấy sản phẩm.");
  }

  if (products.length !== uniqueProductIds.length) {
    throw new CheckoutError("Một số sản phẩm không tồn tại hoặc đã ngừng bán.");
  }

  // Check all products are active
  const inactiveProducts = products.filter((p) => !p.is_active);
  if (inactiveProducts.length > 0) {
    throw new CheckoutError("Một sản phẩm trong giỏ hiện không còn bán.");
  }

  // SECURITY GUARD: Reject any FREE products from checkout
  const freeProducts = products.filter((p) => p.product_type === "FREE");
  if (freeProducts.length > 0) {
    throw new CheckoutError("Không thể thanh toán sản phẩm miễn phí qua cổng này.");
  }

  // 3. Calculate totals from DB prices (NEVER from client)
  const subtotal = products.reduce((sum: number, p) => sum + p.price, 0);
  const discount = 0; // No discount logic in this milestone
  const totalAmount = subtotal - discount;

  if (totalAmount <= 0) {
    throw new CheckoutError("Tổng tiền đơn hàng không hợp lệ.");
  }

  // 4. Find or create customer
  const email = normalizeEmail(input.customerEmail);
  const name = input.customerName.trim();
  const phone = input.customerPhone.trim();

  const customerId = await resolveCustomer(supabase, { name, email, phone });

  // 5. Generate unique codes with collision retry
  const orderCode = await generateUniqueOrderCode(supabase);
  const paymentOrderCode = await generateUniquePaymentOrderCode(supabase);

  // 6. Insert order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_code: orderCode,
      customer_id: customerId,
      subtotal,
      discount,
      total_amount: totalAmount,
      payment_method: "payos",
      payment_order_code: paymentOrderCode,
      status: "PENDING",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[OrderService] Order insert error:", orderError?.message);
    throw new CheckoutError("Không thể tạo đơn hàng. Vui lòng thử lại.");
  }

  // 7. Insert order items (price snapshot)
  const orderItems = products.map((p: Pick<DbProduct, "id" | "name" | "price">) => ({
    order_id: order.id,
    product_id: p.id,
    product_name: p.name,
    unit_price: p.price,
  }));

  const { data: insertedOrderItems, error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems)
    .select("id, product_id");

  if (itemsError) {
    console.error("[OrderService] Order items insert error:", itemsError.message);
    // Rollback: delete the orphan order
    await supabase.from("orders").delete().eq("id", order.id);
    throw new CheckoutError("Không thể tạo đơn hàng. Vui lòng thử lại.");
  }

  // 8. Snapshot bonuses
  if (insertedOrderItems && insertedOrderItems.length > 0) {
    const { data: bonusRelations, error: bonusError } = await supabase
      .from("product_relations")
      .select("source_product_id, target_product:products!product_relations_target_product_id_fkey(id, name, is_active, product_type)")
      .in("source_product_id", uniqueProductIds)
      .eq("relation_type", "BONUS_INCLUDED");

    if (!bonusError && bonusRelations && bonusRelations.length > 0) {
      const bonusItemsToInsert: Array<{
        order_id: string;
        source_order_item_id: string;
        source_product_id: string;
        bonus_product_id: string;
        bonus_name_snapshot: string;
      }> = [];

      for (const rel of bonusRelations) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const target = rel.target_product as any;
        if (target && target.is_active && target.product_type === "BONUS") {
          const sourceItem = insertedOrderItems.find((item) => item.product_id === rel.source_product_id);
          if (sourceItem) {
            // Ensure unique constraint: (order_id, bonus_product_id)
            if (!bonusItemsToInsert.some(b => b.bonus_product_id === target.id)) {
              bonusItemsToInsert.push({
                order_id: order.id,
                source_order_item_id: sourceItem.id,
                source_product_id: sourceItem.product_id,
                bonus_product_id: target.id,
                bonus_name_snapshot: target.name,
              });
            }
          }
        }
      }

      if (bonusItemsToInsert.length > 0) {
        const { error: insertBonusError } = await supabase
          .from("order_bonus_items")
          .insert(bonusItemsToInsert);
        
        if (insertBonusError) {
          console.error("[OrderService] Order bonus items insert error:", insertBonusError.message);
          // Non-fatal, just log it. The main order is created successfully.
        }
      }
    }
  }

  console.log(
    `[OrderService] Order created: ${orderCode} paymentCode=${paymentOrderCode} items=${products.length} total=${totalAmount}`,
  );

  return {
    orderId: order.id,
    orderCode,
    paymentOrderCode,
    customerId,
    subtotal,
    discount,
    totalAmount,
    items: products.map((p: Pick<DbProduct, "id" | "name" | "price">) => ({
      productId: p.id,
      productName: p.name,
      unitPrice: p.price,
    })),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Find existing customer by normalized email, or create new one.
 */
async function resolveCustomer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  data: { name: string; email: string; phone: string },
): Promise<string> {
  // Try to find existing customer
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .ilike("email", data.email)
    .limit(1)
    .single();

  if (existing) {
    // Update name/phone in case they changed
    await supabase
      .from("customers")
      .update({ name: data.name, phone: data.phone })
      .eq("id", existing.id);
    return existing.id;
  }

  // Create new customer
  const { data: created, error } = await supabase
    .from("customers")
    .insert({ name: data.name, email: data.email, phone: data.phone })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[OrderService] Customer create error:", error?.message);
    throw new CheckoutError("Không thể tạo thông tin khách hàng.");
  }

  return created.id;
}

/**
 * Generate unique order code with collision retry.
 */
async function generateUniqueOrderCode(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  maxRetries = 3,
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateOrderCode();
    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("order_code", code)
      .limit(1)
      .single();

    if (!existing) return code;
    console.warn(`[OrderService] Order code collision: ${code}, retrying...`);
  }
  throw new CheckoutError("Không thể tạo mã đơn hàng. Vui lòng thử lại.");
}

/**
 * Generate unique numeric payment order code with collision retry.
 */
export async function generateUniquePaymentOrderCode(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  maxRetries = 3,
): Promise<number> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generatePaymentOrderCode();
    
    // Check orders table
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("payment_order_code", code)
      .limit(1)
      .maybeSingle();

    if (existingOrder) {
      console.warn(`[OrderService] Payment order code collision in orders: ${code}, retrying...`);
      continue;
    }
    
    // Check payment_attempts table
    const { data: existingAttempt } = await supabase
      .from("payment_attempts")
      .select("id")
      .eq("provider_order_code", code)
      .limit(1)
      .maybeSingle();
      
    if (existingAttempt) {
      console.warn(`[OrderService] Payment order code collision in payment_attempts: ${code}, retrying...`);
      continue;
    }
      
    return code;
  }
  throw new CheckoutError("Không thể tạo mã thanh toán. Vui lòng thử lại.");
}

// ─── Error ─────────────────────────────────────────────────────────

/**
 * Checkout-specific error with a customer-safe Vietnamese message.
 */
export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}
