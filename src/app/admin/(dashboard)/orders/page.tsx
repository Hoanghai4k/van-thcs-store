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

import { Search } from "lucide-react";

interface Props {
  searchParams: Promise<{ status?: string; page?: string; search?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const statusFilter = params.status ?? "";
  const searchFilter = params.search ?? "";
  const page = parseInt(params.page ?? "1", 10);

  const result = await listOrders({
    page,
    pageSize: 20,
    status: statusFilter || undefined,
    search: searchFilter || undefined,
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Quản lý đơn hàng</h1>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form className="flex-1 flex gap-2" method="GET" action="/admin/orders">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={searchFilter}
              placeholder="Tìm theo mã đơn hàng..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Tìm kiếm
          </button>
        </form>
        
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={`/admin/orders?${new URLSearchParams({
                ...(searchFilter ? { search: searchFilter } : {}),
                ...(filter.value ? { status: filter.value } : {}),
              }).toString()}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === filter.value
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
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
    PENDING: { class: "bg-yellow-50 text-yellow-700 border border-yellow-200", label: "Chờ thanh toán" },
    PAID: { class: "bg-green-50 text-green-700 border border-green-200", label: "Đã thanh toán" },
    FAILED: { class: "bg-red-50 text-red-700 border border-red-200", label: "Thất bại" },
    CANCELLED: { class: "bg-slate-50 text-slate-600 border border-slate-200", label: "Đã hủy" },
    REFUNDED: { class: "bg-purple-50 text-purple-700 border border-purple-200", label: "Hoàn tiền" },
  };
  const c = config[status] ?? { class: "bg-slate-50 text-slate-600 border border-slate-200", label: status };
  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${c.class}`}>
      {c.label}
    </span>
  );
}
