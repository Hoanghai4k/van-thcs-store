/**
 * Order status page.
 * Displays order details based on order code from URL.
 *
 * This page serves as both:
 * - The order detail/status page
 * - The payOS return/cancel URL landing page
 *
 * SECURITY: Requires a valid order-access cookie to view private details.
 * The cookie is issued by:
 * - /api/checkout (during order creation)
 * - /api/orders/lookup (after email verification)
 *
 * Without a valid cookie, the user is redirected to /order/lookup
 * with the orderCode prefilled for convenience.
 *
 * CRITICAL: This page does NOT set order status.
 * Only the webhook can mark an order as PAID.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { redirect } from "next/navigation";
import { ResumePaymentButton } from "@/components/order/resume-payment-button";
import { getOrderAccessCookie } from "@/lib/auth/order-access";
import { DeliveryButton } from "./delivery-button";

interface Props {
  params: Promise<{ orderCode: string }>;
}

async function getOrderByCode(orderCode: string) {
  const supabase = getSupabaseAdmin();

  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      *,
      customer:customers(name, email, phone),
      items:order_items(id, product_name, unit_price)
    `)
    .eq("order_code", orderCode)
    .single();

  if (error || !order) return null;
  return order;
}

export default async function OrderStatusPage({ params }: Props) {
  const { orderCode } = await params;

  // 1. Verify order-access cookie
  const accessResult = await getOrderAccessCookie(orderCode);

  if (!accessResult.valid) {
    // No valid cookie — redirect to lookup with prefilled orderCode
    redirect(`/order/lookup?orderCode=${encodeURIComponent(orderCode)}`);
  }

  // 2. Fetch order from DB
  const order = await getOrderByCode(orderCode);

  if (!order) {
    // Order not found — redirect to lookup (don't reveal existence)
    redirect(`/order/lookup?orderCode=${encodeURIComponent(orderCode)}`);
  }

  // 3. Verify cookie's orderId matches the DB order
  if (order.id !== accessResult.orderId) {
    redirect(`/order/lookup?orderCode=${encodeURIComponent(orderCode)}`);
  }

  // 4. Render order details (authorized)
  const customer = order.customer as { name: string; email: string; phone: string | null } | null;
  const items = (order.items as Array<{ id: string; product_name: string; unit_price: number }>) ?? [];

  const statusConfig = getStatusConfig(order.status);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Status Header */}
      <div className="text-center mb-8">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${statusConfig.bgColor}`}>
          <statusConfig.Icon className={`w-8 h-8 ${statusConfig.iconColor}`} />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          {statusConfig.title}
        </h1>
        <p className="text-text-secondary">{statusConfig.subtitle}</p>
      </div>

      {/* Order Details Card */}
      <div className="bg-white rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-text-primary">Chi tiết đơn hàng</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.badgeClass}`}>
            {statusConfig.badgeText}
          </span>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Mã đơn hàng</span>
            <span className="font-mono font-bold text-text-primary">{order.order_code}</span>
          </div>
          {customer && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Khách hàng</span>
              <span className="text-text-primary">{customer.name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-text-secondary">Ngày tạo</span>
            <span className="text-text-primary">{formatDateTime(order.created_at)}</span>
          </div>
          {order.paid_at && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Ngày thanh toán</span>
              <span className="text-text-primary">{formatDateTime(order.paid_at)}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="border-t border-border mt-4 pt-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Sản phẩm</h3>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-text-primary">{item.product_name}</span>
                <span className="text-text-secondary font-medium">{formatCurrency(item.unit_price)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="border-t border-border mt-4 pt-4">
          <div className="flex justify-between font-semibold">
            <span className="text-text-primary">Tổng cộng</span>
            <span className="text-primary-600">{formatCurrency(order.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* PAID delivery CTA */}
      {order.status === "PAID" && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6 text-center">
          <p className="text-green-800 font-medium mb-3">
            Tài liệu của bạn đã sẵn sàng để tải xuống.
          </p>
          <DeliveryButton orderCode={order.order_code} orderId={order.id} />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {order.status === "PENDING" && (
          <ResumePaymentButton
            orderCode={order.order_code}
            totalAmount={order.total_amount}
          />
        )}
        <Link
          href="/order/lookup"
          className="px-6 py-3 border border-border text-text-primary font-medium rounded-xl hover:bg-surface-alt transition-colors text-center"
        >
          Tra cứu đơn hàng
        </Link>
        <Link
          href="/products"
          className="px-6 py-3 border border-border text-text-primary font-medium rounded-xl hover:bg-surface-alt transition-colors text-center"
        >
          Tiếp tục mua sắm
        </Link>
      </div>
    </div>
  );
}

function getStatusConfig(status: string) {
  switch (status) {
    case "PAID":
      return {
        Icon: CheckCircle,
        title: "Thanh toán thành công",
        subtitle: "Cảm ơn bạn! Tài liệu của bạn đã sẵn sàng.",
        bgColor: "bg-green-100",
        iconColor: "text-green-600",
        badgeClass: "bg-green-100 text-green-700",
        badgeText: "Đã thanh toán",
      };
    case "PENDING":
      return {
        Icon: Clock,
        title: "Đơn hàng đang chờ thanh toán",
        subtitle: "Đơn hàng đã được tạo. Vui lòng hoàn tất thanh toán để nhận tài liệu.",
        bgColor: "bg-yellow-100",
        iconColor: "text-yellow-600",
        badgeClass: "bg-yellow-100 text-yellow-700",
        badgeText: "Chờ thanh toán",
      };
    case "CANCELLED":
      return {
        Icon: XCircle,
        title: "Đơn hàng đã hủy",
        subtitle: "Đơn hàng này đã bị hủy. Bạn có thể tạo đơn hàng mới.",
        bgColor: "bg-gray-100",
        iconColor: "text-gray-500",
        badgeClass: "bg-gray-100 text-gray-700",
        badgeText: "Đã hủy",
      };
    case "FAILED":
      return {
        Icon: AlertTriangle,
        title: "Thanh toán thất bại",
        subtitle: "Thanh toán không thành công. Vui lòng tạo đơn hàng mới để thử lại.",
        bgColor: "bg-red-100",
        iconColor: "text-red-600",
        badgeClass: "bg-red-100 text-red-700",
        badgeText: "Thất bại",
      };
    default:
      return {
        Icon: Clock,
        title: "Đơn hàng",
        subtitle: "",
        bgColor: "bg-gray-100",
        iconColor: "text-gray-500",
        badgeClass: "bg-gray-100 text-gray-700",
        badgeText: status,
      };
  }
}
