/**
 * Admin Orders List Page.
 * Displays real orders from Supabase with status filters.
 */

import Link from "next/link";
import { listOrders } from "@/features/orders/queries";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const STATUS_FILTERS = [
  { label: "Tất cả", value: "" },
  { label: "Chờ thanh toán", value: "PENDING" },
  { label: "Đã thanh toán", value: "PAID" },
  { label: "Thất bại", value: "FAILED" },
  { label: "Đã hủy", value: "CANCELLED" },
];

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const statusFilter = params.status ?? "";
  const page = parseInt(params.page ?? "1", 10);

  const result = await listOrders({
    page,
    pageSize: 20,
    status: statusFilter || undefined,
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Quản lý đơn hàng</h1>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin/orders${filter.value ? `?status=${filter.value}` : ""}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === filter.value
                ? "bg-primary-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {/* Orders Table */}
      {result.orders.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {statusFilter
            ? `Không có đơn hàng nào có trạng thái "${statusFilter}".`
            : "Chưa có đơn hàng nào."}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Mã đơn</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Khách hàng</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">SP</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Tổng tiền</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Trạng thái</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Ngày tạo</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Thanh toán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {order.orderCode}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-900">{order.customerName}</div>
                      <div className="text-xs text-slate-500">{order.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600">
                      {order.itemCount}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {order.paidAt ? formatDateTime(order.paidAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {result.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <span className="text-sm text-slate-500">
                Trang {result.page} / {result.totalPages} ({result.total} đơn)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/orders?page=${page - 1}${statusFilter ? `&status=${statusFilter}` : ""}`}
                    className="px-3 py-1 text-sm bg-slate-100 rounded hover:bg-slate-200"
                  >
                    ← Trước
                  </Link>
                )}
                {page < result.totalPages && (
                  <Link
                    href={`/admin/orders?page=${page + 1}${statusFilter ? `&status=${statusFilter}` : ""}`}
                    className="px-3 py-1 text-sm bg-slate-100 rounded hover:bg-slate-200"
                  >
                    Tiếp →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    PENDING: { class: "bg-yellow-100 text-yellow-700", label: "Chờ TT" },
    PAID: { class: "bg-green-100 text-green-700", label: "Đã TT" },
    FAILED: { class: "bg-red-100 text-red-700", label: "Thất bại" },
    CANCELLED: { class: "bg-gray-100 text-gray-600", label: "Đã hủy" },
    REFUNDED: { class: "bg-purple-100 text-purple-700", label: "Hoàn tiền" },
  };
  const c = config[status] ?? { class: "bg-gray-100 text-gray-600", label: status };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.class}`}>
      {c.label}
    </span>
  );
}
