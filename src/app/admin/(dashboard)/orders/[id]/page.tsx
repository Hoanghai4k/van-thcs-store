/**
 * Admin Order Detail Page.
 * Displays full order information including customer, items, payment metadata.
 * No "Mark PAID" button — status changes are webhook-only.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOrderById } from "@/features/orders/queries";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { notFound } from "next/navigation";
import { ResendEmailButton } from "@/components/admin/resend-email-button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  const statusConfig: Record<string, { class: string; label: string }> = {
    PENDING: { class: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300", label: "Chờ thanh toán" },
    PAID: { class: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300", label: "Đã thanh toán" },
    FAILED: { class: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300", label: "Thất bại" },
    CANCELLED: { class: "bg-surface-alt text-text-secondary border border-border", label: "Đã hủy" },
    REFUNDED: { class: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300", label: "Hoàn tiền" },
  };
  const sc = statusConfig[order.status] ?? { class: "bg-surface-alt text-text-secondary border border-border", label: order.status };

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/orders" className="text-text-muted hover:text-text-primary">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">
            Đơn hàng {order.orderCode}
          </h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${sc.class}`}>
          {sc.label}
        </span>
        {order.status === "PAID" && (
          <ResendEmailButton orderId={order.id} orderCode={order.orderCode} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items & Order Summary */}
          <div className="bg-surface rounded-xl border border-border p-0 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold text-text-primary">Chi tiết sản phẩm ({order.items.length})</h2>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <span className="text-text-primary font-medium">{item.productName}</span>
                    <span className="text-text-secondary font-medium">{formatCurrency(item.unitPrice)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-surface-alt rounded-xl p-4 mt-6 space-y-2 text-sm border border-border">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Tạm tính</span>
                  <span className="font-medium text-text-primary">{formatCurrency(order.subtotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Giảm giá</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <div className="pt-2 mt-2 border-t border-border flex justify-between font-bold text-lg">
                  <span className="text-text-primary">Tổng thanh toán</span>
                  <span className="text-primary-600">{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment & System Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
              <h2 className="font-semibold text-text-primary mb-4">Giao dịch thanh toán</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Phương thức</dt>
                  <dd className="text-text-primary uppercase font-medium">{order.paymentMethod ?? "—"}</dd>
                </div>
                {order.paymentOrderCode && (
                  <div className="flex justify-between">
                    <dt className="text-text-secondary">Mã TT (provider)</dt>
                    <dd className="font-mono text-text-primary">{order.paymentOrderCode}</dd>
                  </div>
                )}
                {order.paymentTransactionId && (
                  <div className="flex justify-between">
                    <dt className="text-text-secondary">Mã giao dịch</dt>
                    <dd className="font-mono text-xs text-text-primary bg-surface-alt px-2 py-1 rounded">{order.paymentTransactionId}</dd>
                  </div>
                )}
              </dl>
            </div>
            
            <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
              <h2 className="font-semibold text-text-primary mb-4">Lịch sử hệ thống</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Mã hệ thống (ID)</dt>
                  <dd className="font-mono text-xs text-text-muted truncate max-w-[150px]" title={order.id}>{order.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Ngày tạo</dt>
                  <dd className="text-text-primary">{formatDateTime(order.createdAt)}</dd>
                </div>
                {order.paidAt && (
                  <div className="flex justify-between">
                    <dt className="text-text-secondary">Ngày thanh toán</dt>
                    <dd className="text-text-primary">{formatDateTime(order.paidAt)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Cập nhật cuối</dt>
                  <dd className="text-text-primary">{formatDateTime(order.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Customer Profile */}
          <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
            <h2 className="font-semibold text-text-primary mb-4">Hồ sơ khách hàng</h2>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full flex items-center justify-center font-bold text-lg">
                {order.customerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-text-primary">{order.customerName}</p>
                <p className="text-sm text-text-secondary">Khách mua hàng</p>
              </div>
            </div>
            
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-text-secondary mb-1">Email liên hệ</dt>
                <dd className="text-text-primary font-medium">{order.customerEmail}</dd>
              </div>
              {order.customerPhone && (
                <div>
                  <dt className="text-text-secondary mb-1">Số điện thoại</dt>
                  <dd className="text-text-primary font-medium">{order.customerPhone}</dd>
                </div>
              )}
            </dl>
          </div>
          
          {/* Delivery Actions */}
          {order.status === "PAID" && (
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800 p-5">
              <h2 className="font-semibold text-primary-900 dark:text-primary-100 mb-2">Hỗ trợ giao hàng</h2>
              <p className="text-sm text-primary-700 dark:text-primary-300 mb-4">
                Nếu khách hàng chưa nhận được email tài liệu, bạn có thể gửi lại thủ công.
              </p>
              <ResendEmailButton orderId={order.id} orderCode={order.orderCode} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
