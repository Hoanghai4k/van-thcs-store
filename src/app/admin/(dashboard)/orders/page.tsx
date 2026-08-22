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
      <h1 className="text-2xl font-bold text-text-primary mb-6">Quản lý đơn hàng</h1>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form className="flex-1 flex gap-2" method="GET" action="/admin/orders">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              name="search"
              defaultValue={searchFilter}
              placeholder="Tìm theo mã đơn hàng..."
              className="w-full pl-9 pr-3 py-2 border border-border bg-surface text-text-primary placeholder:text-text-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-surface-alt text-text-secondary border border-border rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors"
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
                  : "bg-surface text-text-secondary border border-border hover:bg-surface-hover"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      {result.orders.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          {statusFilter
            ? `Không có đơn hàng nào có trạng thái "${statusFilter}".`
            : "Chưa có đơn hàng nào."}
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-alt border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Mã đơn</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Khách hàng</th>
                  <th className="text-center py-3 px-4 font-medium text-text-secondary">SP</th>
                  <th className="text-right py-3 px-4 font-medium text-text-secondary">Tổng tiền</th>
                  <th className="text-center py-3 px-4 font-medium text-text-secondary">Trạng thái</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Ngày tạo</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Thanh toán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.orders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-hover transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {order.orderCode}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-text-primary">{order.customerName}</div>
                      <div className="text-xs text-text-muted">{order.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-center text-text-secondary">
                      {order.itemCount}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-text-primary">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-text-secondary text-xs">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-text-secondary text-xs">
                      {order.paidAt ? formatDateTime(order.paidAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {result.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-sm text-text-secondary">
                Trang {result.page} / {result.totalPages} ({result.total} đơn)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/orders?page=${page - 1}${statusFilter ? `&status=${statusFilter}` : ""}`}
                    className="px-3 py-1 text-sm bg-surface-alt border border-border text-text-secondary rounded hover:bg-surface-hover transition-colors"
                  >
                    ← Trước
                  </Link>
                )}
                {page < result.totalPages && (
                  <Link
                    href={`/admin/orders?page=${page + 1}${statusFilter ? `&status=${statusFilter}` : ""}`}
                    className="px-3 py-1 text-sm bg-surface-alt border border-border text-text-secondary rounded hover:bg-surface-hover transition-colors"
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
    PENDING: { class: "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/50", label: "Chờ thanh toán" },
    PAID: { class: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/50", label: "Đã thanh toán" },
    FAILED: { class: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50", label: "Thất bại" },
    CANCELLED: { class: "bg-surface-alt text-text-secondary border border-border", label: "Đã hủy" },
    REFUNDED: { class: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50", label: "Hoàn tiền" },
  };
  const c = config[status] ?? { class: "bg-surface-alt text-text-secondary border border-border", label: status };
  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${c.class}`}>
      {c.label}
    </span>
  );
}
