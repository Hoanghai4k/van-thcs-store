"use client";

import Link from "next/link";
import {
  Trash2,
  ShoppingBag,
  ArrowRight,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { formatCurrency } from "@/lib/utils";
import { siteConfig } from "@/config/site";

export default function CartPage() {
  const { items, removeItem, clearCart, totalPrice } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-surface-alt rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="w-10 h-10 text-text-muted" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-3">
          Giỏ hàng của bạn đang trống
        </h1>
        <p className="text-text-secondary mb-6">
          Hãy chọn tài liệu phù hợp trước khi thanh toán.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-primary-600 text-white font-medium px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors"
        >
          Xem tài liệu
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Tiếp tục mua sắm
      </Link>

      <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-8">
        Giỏ hàng ({items.length} sản phẩm)
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center gap-4 bg-white p-4 rounded-xl border border-border"
            >
              <div className="w-16 h-16 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-8 h-8 text-primary-300" />
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/products/${item.slug}`}
                  className="font-medium text-text-primary text-sm hover:text-primary-600 transition-colors line-clamp-2"
                >
                  {item.name}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-primary-600">
                    {formatCurrency(item.price)}
                  </span>
                  {item.originalPrice && item.originalPrice > item.price && (
                    <span className="text-xs text-text-muted line-through">
                      {formatCurrency(item.originalPrice)}
                    </span>
                  )}
                  <span className="text-xs text-text-muted bg-surface-alt px-1.5 py-0.5 rounded">
                    {siteConfig.store.supportedFormatsLabel}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeItem(item.productId)}
                className="p-2 text-text-muted hover:text-error hover:bg-red-50 rounded-lg transition-colors"
                aria-label={`Xóa ${item.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            onClick={clearCart}
            className="text-sm text-text-muted hover:text-error transition-colors"
          >
            Xóa tất cả
          </button>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 bg-white rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="font-semibold text-text-primary mb-4">
              Tóm tắt đơn hàng
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Tạm tính ({items.length} sản phẩm)</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between font-semibold text-text-primary text-base">
                <span>Tổng cộng</span>
                <span className="text-primary-600">
                  {formatCurrency(totalPrice)}
                </span>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-3 mb-4">
              Giá sẽ được xác nhận lại từ hệ thống khi thanh toán.
            </p>
            <Link
              href="/checkout"
              className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-700 shadow-md hover:shadow-lg transition-all"
            >
              Tiến hành thanh toán
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
