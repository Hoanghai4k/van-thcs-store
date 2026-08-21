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
    PENDING: { class: "bg-yellow-100 text-yellow-700", label: "Chờ thanh toán" },
    PAID: { class: "bg-green-100 text-green-700", label: "Đã thanh toán" },
    FAILED: { class: "bg-red-100 text-red-700", label: "Thất bại" },
    CANCELLED: { class: "bg-gray-100 text-gray-600", label: "Đã hủy" },
    REFUNDED: { class: "bg-purple-100 text-purple-700", label: "Hoàn tiền" },
  };
  const sc = statusConfig[order.status] ?? { class: "bg-gray-100 text-gray-600", label: order.status };

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/orders" className="text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">
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
          <div className="bg-white rounded-xl border border-slate-200 p-0 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Chi tiết sản phẩm ({order.items.length})</h2>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <span className="text-slate-900 font-medium">{item.productName}</span>
                    <span className="text-slate-600 font-medium">{formatCurrency(item.unitPrice)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 rounded-xl p-4 mt-6 space-y-2 text-sm border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tạm tính</span>
                  <span className="font-medium text-slate-900">{formatCurrency(order.subtotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Giảm giá</span>
                    <span className="text-green-600 font-medium">-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-lg">
                  <span className="text-slate-900">Tổng thanh toán</span>
                  <span className="text-primary-600">{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment & System Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-4">Giao dịch thanh toán</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Phương thức</dt>
                  <dd className="text-slate-900 uppercase font-medium">{order.paymentMethod ?? "—"}</dd>
                </div>
                {order.paymentOrderCode && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Mã TT (provider)</dt>
                    <dd className="font-mono text-slate-900">{order.paymentOrderCode}</dd>
                  </div>
                )}
                {order.paymentTransactionId && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Mã giao dịch</dt>
                    <dd className="font-mono text-xs text-slate-900 bg-slate-100 px-2 py-1 rounded">{order.paymentTransactionId}</dd>
                  </div>
                )}
              </dl>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-4">Lịch sử hệ thống</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Mã hệ thống (ID)</dt>
                  <dd className="font-mono text-xs text-slate-500 truncate max-w-[150px]" title={order.id}>{order.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Ngày tạo</dt>
                  <dd className="text-slate-900">{formatDateTime(order.createdAt)}</dd>
                </div>
                {order.paidAt && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Ngày thanh toán</dt>
                    <dd className="text-slate-900">{formatDateTime(order.paidAt)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-500">Cập nhật cuối</dt>
                  <dd className="text-slate-900">{formatDateTime(order.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Customer Profile */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">Hồ sơ khách hàng</h2>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-lg">
                {order.customerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-900">{order.customerName}</p>
                <p className="text-sm text-slate-500">Khách mua hàng</p>
              </div>
            </div>
            
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-slate-500 mb-1">Email liên hệ</dt>
                <dd className="text-slate-900 font-medium">{order.customerEmail}</dd>
              </div>
              {order.customerPhone && (
                <div>
                  <dt className="text-slate-500 mb-1">Số điện thoại</dt>
                  <dd className="text-slate-900 font-medium">{order.customerPhone}</dd>
                </div>
              )}
            </dl>
          </div>
          
          {/* Delivery Actions */}
          {order.status === "PAID" && (
            <div className="bg-primary-50 rounded-xl border border-primary-100 p-5">
              <h2 className="font-semibold text-primary-900 mb-2">Hỗ trợ giao hàng</h2>
              <p className="text-sm text-primary-700 mb-4">
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
