import Link from "next/link";
import { Search, UserCircle2 } from "lucide-react";
import { listCustomers } from "@/features/customers/queries";
import { formatDateTime } from "@/lib/utils";

interface Props {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function AdminCustomersPage({ searchParams }: Props) {
  const params = await searchParams;
  const searchFilter = params.search ?? "";
  const page = parseInt(params.page ?? "1", 10);

  const result = await listCustomers({
    page,
    pageSize: 20,
    search: searchFilter || undefined,
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Khách hàng</h1>

      {/* Search Filter */}
      <div className="mb-6">
        <form className="flex gap-2 max-w-md" method="GET" action="/admin/customers">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={searchFilter}
              placeholder="Tìm theo tên hoặc email..."
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
      </div>

      {/* Customers Table */}
      {result.customers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
          <UserCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">Không tìm thấy khách hàng</h3>
          <p className="text-slate-500 mb-4">
            {searchFilter ? `Không có khách hàng nào khớp với "${searchFilter}".` : "Chưa có dữ liệu khách hàng."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Khách hàng</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Số điện thoại</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Ngày tham gia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{customer.name}</div>
                          <div className="text-xs text-slate-500">{customer.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {customer.phone || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {formatDateTime(customer.created_at)}
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
                Trang {result.page} / {result.totalPages} ({result.total} khách hàng)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/customers?page=${page - 1}${searchFilter ? `&search=${searchFilter}` : ""}`}
                    className="px-3 py-1 text-sm bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                  >
                    ← Trước
                  </Link>
                )}
                {page < result.totalPages && (
                  <Link
                    href={`/admin/customers?page=${page + 1}${searchFilter ? `&search=${searchFilter}` : ""}`}
                    className="px-3 py-1 text-sm bg-slate-100 rounded hover:bg-slate-200 transition-colors"
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
