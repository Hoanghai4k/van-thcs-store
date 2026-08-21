"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  Pencil,
  FileText,
  Loader2,
  Package,
} from "lucide-react";
import type { ProductWithCategory } from "@/features/products/types";
import type { DbCategory } from "@/types/database";
import { toggleProductActive } from "@/features/products/actions";
import { getProductAssetUrl } from "@/lib/storage/storage";
import { formatCurrency } from "@/lib/utils";

interface AdminProductListProps {
  products: ProductWithCategory[];
  categories: DbCategory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentSearch?: string;
  currentCategory?: string;
  currentStatus?: string;
}

export function AdminProductList({
  products,
  categories,
  total,
  page,
  totalPages,
  currentSearch,
  currentCategory,
  currentStatus,
}: AdminProductListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch ?? "");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (currentCategory) params.set("category", currentCategory);
    if (currentStatus) params.set("status", currentStatus);
    router.push(`/admin/products?${params.toString()}`);
  }

  function handleFilter(key: string, value: string) {
    const params = new URLSearchParams();
    if (currentSearch) params.set("search", currentSearch);
    if (key === "category" && value) params.set("category", value);
    else if (currentCategory && key !== "category")
      params.set("category", currentCategory);
    if (key === "status" && value) params.set("status", value);
    else if (currentStatus && key !== "status")
      params.set("status", currentStatus);
    router.push(`/admin/products?${params.toString()}`);
  }

  function handleToggle(productId: string, currentActive: boolean) {
    setFeedback(null);
    startTransition(async () => {
      const result = await toggleProductActive(productId, !currentActive);
      if (result.success) {
        setFeedback({
          type: "success",
          message: currentActive
            ? "Đã ẩn sản phẩm."
            : "Đã kích hoạt sản phẩm.",
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: result.error ?? "Có lỗi xảy ra.",
        });
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Quản lý sản phẩm{" "}
          <span className="text-sm font-normal text-slate-500">
            ({total} sản phẩm)
          </span>
        </h1>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Thêm sản phẩm
        </Link>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm sản phẩm..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition-colors"
          >
            Tìm
          </button>
        </form>

        <select
          value={currentCategory ?? ""}
          onChange={(e) => handleFilter("category", e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <select
          value={currentStatus ?? ""}
          onChange={(e) => handleFilter("status", e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang bán</option>
          <option value="inactive">Nháp / Ẩn</option>
        </select>
      </div>

      {/* Product Table */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">Chưa có sản phẩm</h3>
          <p className="text-slate-500 mb-4">Bạn chưa có sản phẩm nào phù hợp với tìm kiếm này.</p>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm sản phẩm
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Sản phẩm
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Danh mục
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">
                    Định dạng
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    Giá
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">
                    Trạng thái
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">
                    Cập nhật
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => {
                  const thumbUrl = getProductAssetUrl(product.thumbnail_path);
                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-slate-200">
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FileText className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-[200px]" title={product.name}>
                              {product.name}
                            </p>
                            <p className="text-xs text-slate-400 font-mono truncate max-w-[200px]" title={product.slug}>
                              {product.slug}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {product.category?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 uppercase border border-slate-200">
                          {product.file_format || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 whitespace-nowrap">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.is_active
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-slate-50 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {product.is_active ? (
                            <>
                              <Eye className="w-3 h-3" /> Đang bán
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" /> Bản nháp
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs whitespace-nowrap">
                        {new Date(product.updated_at).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() =>
                              handleToggle(product.id, product.is_active)
                            }
                            disabled={isPending}
                            className="p-1.5 text-slate-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                            title={
                              product.is_active ? "Ẩn sản phẩm" : "Kích hoạt"
                            }
                          >
                            {isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : product.is_active ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Trang {page} / {totalPages}
              </p>
              <div className="flex gap-1">
                {page > 1 && (
                  <Link
                    href={`/admin/products?page=${page - 1}${currentSearch ? `&search=${currentSearch}` : ""}${currentCategory ? `&category=${currentCategory}` : ""}${currentStatus ? `&status=${currentStatus}` : ""}`}
                    className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-50"
                  >
                    Trước
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/products?page=${page + 1}${currentSearch ? `&search=${currentSearch}` : ""}${currentCategory ? `&category=${currentCategory}` : ""}${currentStatus ? `&status=${currentStatus}` : ""}`}
                    className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-50"
                  >
                    Sau
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
