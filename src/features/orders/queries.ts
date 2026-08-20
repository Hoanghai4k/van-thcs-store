/**
 * Order queries.
 * All queries use Supabase admin client (service_role) since
 * orders/customers tables are RLS-protected for server-only access.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/utils";
import { PAGINATION } from "@/lib/constants";
import type { OrderWithItems } from "./types";

/**
 * Look up an order by order code and customer email.
 * Both must match for security (prevents enumeration).
 */
export async function lookupOrder(
  orderCode: string,
  email: string,
): Promise<OrderWithItems | null> {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = normalizeEmail(email);

  // Query order with customer join
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      *,
      customer:customers!inner(id, name, email, phone),
      items:order_items(id, product_id, product_name, unit_price)
    `)
    .eq("order_code", orderCode)
    .single();

  if (error || !order) {
    return null;
  }

  // Verify email matches (case-insensitive, already normalized in DB)
  const customer = order.customer as { id: string; name: string; email: string; phone: string | null };
  if (customer.email.toLowerCase() !== normalizedEmail) {
    return null; // Email doesn't match — don't reveal the order exists
  }

  const items = (order.items as Array<{ id: string; product_id: string; product_name: string; unit_price: number }>) ?? [];

  return {
    id: order.id,
    orderCode: order.order_code,
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    subtotal: order.subtotal,
    discount: order.discount,
    totalAmount: order.total_amount,
    paymentMethod: order.payment_method,
    paymentOrderCode: order.payment_order_code,
    paymentTransactionId: order.payment_transaction_id,
    status: order.status,
    paidAt: order.paid_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      unitPrice: item.unit_price,
    })),
  };
}

/**
 * Get order by ID (admin use).
 */
export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  const supabase = getSupabaseAdmin();

  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      *,
      customer:customers(id, name, email, phone),
      items:order_items(id, product_id, product_name, unit_price)
    `)
    .eq("id", id)
    .single();

  if (error || !order) {
    return null;
  }

  const customer = order.customer as { id: string; name: string; email: string; phone: string | null } | null;
  const items = (order.items as Array<{ id: string; product_id: string; product_name: string; unit_price: number }>) ?? [];

  return {
    id: order.id,
    orderCode: order.order_code,
    customerId: customer?.id ?? "",
    customerName: customer?.name ?? "",
    customerEmail: customer?.email ?? "",
    customerPhone: customer?.phone ?? null,
    subtotal: order.subtotal,
    discount: order.discount,
    totalAmount: order.total_amount,
    paymentMethod: order.payment_method,
    paymentOrderCode: order.payment_order_code,
    paymentTransactionId: order.payment_transaction_id,
    status: order.status,
    paidAt: order.paid_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      unitPrice: item.unit_price,
    })),
  };
}

/**
 * List all orders (admin use).
 */
export async function listOrders(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("orders")
    .select(`
      *,
      customer:customers(name, email),
      items:order_items(id)
    `, { count: "exact" })
    .order("created_at", { ascending: false });

  if (params?.status) {
    query = query.eq("status", params.status as "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED");
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("[Orders] List error:", error.message);
    return { orders: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const orders = (data ?? []).map((row) => {
    const customer = row.customer as { name: string; email: string } | null;
    const items = (row.items as Array<{ id: string }>) ?? [];
    return {
      id: row.id,
      orderCode: row.order_code,
      customerName: customer?.name ?? "",
      customerEmail: customer?.email ?? "",
      itemCount: items.length,
      totalAmount: row.total_amount,
      paymentMethod: row.payment_method,
      status: row.status,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    };
  });

  const total = count ?? 0;

  return {
    orders,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Check if any orders exist for a given email address.
 * Matches all customer rows with the same normalized email.
 */
export async function hasOrdersForEmail(email: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabase
    .from("orders")
    .select(`id, customer:customers!inner(id, email)`)
    .eq("customer.email", normalizedEmail)
    .limit(1);

  if (error || !data || data.length === 0) {
    return false;
  }

  // Supabase inner join with embedded filters behaves correctly,
  // but let's double check it in JavaScript just in case
  const match = data.some((row) => {
    const customer = row.customer as { email: string } | null;
    return customer?.email?.toLowerCase() === normalizedEmail;
  });

  return match;
}

/**
 * Get all orders belonging to a normalized email.
 * Includes items for rendering the list.
 */
export async function getOrdersByEmail(email: string): Promise<OrderWithItems[]> {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      customer:customers!inner(id, name, email, phone),
      items:order_items(id, product_id, product_name, unit_price)
    `)
    .eq("customer.email", normalizedEmail)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  // Filter out any false positives from the join and map to expected format
  const validOrders = data.filter((order) => {
    const customer = order.customer as { email: string } | null;
    return customer?.email?.toLowerCase() === normalizedEmail;
  });

  return validOrders.map((order) => {
    const customer = order.customer as { id: string; name: string; email: string; phone: string | null };
    const items = (order.items as Array<{ id: string; product_id: string; product_name: string; unit_price: number }>) ?? [];

    return {
      id: order.id,
      orderCode: order.order_code,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      subtotal: order.subtotal,
      discount: order.discount,
      totalAmount: order.total_amount,
      paymentMethod: order.payment_method,
      paymentOrderCode: order.payment_order_code,
      paymentTransactionId: order.payment_transaction_id,
      status: order.status,
      paidAt: order.paid_at,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        unitPrice: item.unit_price,
      })),
    };
  });
}
