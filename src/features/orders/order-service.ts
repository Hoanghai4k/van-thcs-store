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
    .select("id, name, price, is_active")
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
  const inactiveProducts = products.filter((p: Pick<DbProduct, "is_active">) => !p.is_active);
  if (inactiveProducts.length > 0) {
    throw new CheckoutError("Một sản phẩm trong giỏ hiện không còn bán.");
  }

  // 3. Calculate totals from DB prices (NEVER from client)
  const subtotal = products.reduce((sum: number, p: Pick<DbProduct, "price">) => sum + p.price, 0);
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

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    console.error("[OrderService] Order items insert error:", itemsError.message);
    // Rollback: delete the orphan order
    await supabase.from("orders").delete().eq("id", order.id);
    throw new CheckoutError("Không thể tạo đơn hàng. Vui lòng thử lại.");
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
async function generateUniquePaymentOrderCode(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  maxRetries = 3,
): Promise<number> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generatePaymentOrderCode();
    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("payment_order_code", code)
      .limit(1)
      .single();

    if (!existing) return code;
    console.warn(`[OrderService] Payment order code collision: ${code}, retrying...`);
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
