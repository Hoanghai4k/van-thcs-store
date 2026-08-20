/**
 * Admin resend delivery email API route.
 *
 * POST /api/admin/orders/resend-email
 *
 * Operational recovery: resend delivery email for a PAID order.
 * Requires admin authentication via requireAdmin().
 *
 * SECURITY:
 * - Requires admin session
 * - Does NOT change order status
 * - Creates/ensures delivery grant if not exists
 * - Bypasses idempotency key for intentional resend
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { ensureDeliveryGrant, revokeExistingTokens } from "@/features/downloads/service";
import { sendDeliveryEmail } from "@/features/emails/service";
import { ORDER_STATUS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    // Require admin auth (throws and redirects if not admin)
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 },
      );
    }

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing orderId" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verify order is PAID
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_code, status, customer_id, total_amount")
      .eq("id", orderId)
      .single();

    if (!order || order.status !== ORDER_STATUS.PAID) {
      return NextResponse.json(
        { success: false, error: "Order is not PAID" },
        { status: 400 },
      );
    }

    // Get customer
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("name, email")
      .eq("id", order.customer_id)
      .single();

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 },
      );
    }

    // Get items
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("product_name, unit_price")
      .eq("order_id", orderId);

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "No order items found" },
        { status: 404 },
      );
    }

    // For resend, revoke existing tokens and create a new one (need raw token for email)
    await revokeExistingTokens(orderId, supabaseAdmin);
    const { grant, rawToken } = await ensureDeliveryGrant(orderId, supabaseAdmin);

    if (!rawToken) {
      return NextResponse.json(
        { success: false, error: "Failed to generate delivery token" },
        { status: 500 },
      );
    }

    // Send email (skip idempotency for intentional resend)
    const result = await sendDeliveryEmail(
      {
        orderId,
        orderCode: order.order_code,
        customerEmail: customer.email,
        customerName: customer.name,
        items: items.map(i => ({ productName: i.product_name, unitPrice: i.unit_price })),
        totalAmount: order.total_amount,
        rawToken,
        deliveryGrantId: grant.id,
      },
      supabaseAdmin,
      { skipIdempotency: true },
    );

    return NextResponse.json({
      success: result.sent,
      error: result.error,
    });
  } catch (error) {
    console.error("[AdminResendEmail] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
