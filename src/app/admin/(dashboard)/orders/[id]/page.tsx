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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Thông tin đơn hàng</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Mã đơn</dt>
              <dd className="font-mono font-bold text-slate-900">{order.orderCode}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">ID</dt>
              <dd className="font-mono text-xs text-slate-500">{order.id}</dd>
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
              <dt className="text-slate-500">Cập nhật lần cuối</dt>
              <dd className="text-slate-900">{formatDateTime(order.updatedAt)}</dd>
            </div>
          </dl>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Khách hàng</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Họ tên</dt>
              <dd className="text-slate-900">{order.customerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="text-slate-900">{order.customerEmail}</dd>
            </div>
            {order.customerPhone && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Điện thoại</dt>
                <dd className="text-slate-900">{order.customerPhone}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Payment Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Thanh toán</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Phương thức</dt>
              <dd className="text-slate-900 uppercase">{order.paymentMethod ?? "—"}</dd>
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
                <dd className="font-mono text-xs text-slate-900">{order.paymentTransactionId}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">
            Sản phẩm ({order.items.length})
          </h2>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm py-1">
                <span className="text-slate-900">{item.productName}</span>
                <span className="text-slate-600 font-medium">{formatCurrency(item.unitPrice)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Tạm tính</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Giảm giá</span>
                <span className="text-green-600">-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base">
              <span>Tổng cộng</span>
              <span className="text-blue-600">{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
