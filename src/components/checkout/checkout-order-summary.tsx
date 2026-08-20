"use client";

import { FileText, ShieldCheck, Download, Headphones } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { formatCurrency } from "@/lib/utils";
import { siteConfig } from "@/config/site";

/**
 * Order summary sidebar for checkout page.
 * Displays cart items, totals, and trust indicators.
 * Prices displayed are for reference only — server recalculates from DB.
 */
export function CheckoutOrderSummary() {
  const { items, totalPrice } = useCart();

  return (
    <div className="sticky top-20 space-y-4">
      {/* Items */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
        <h2 className="font-semibold text-text-primary mb-4">
          Đơn hàng của bạn ({items.length} sản phẩm)
        </h2>
        <div className="space-y-3 mb-4">
          {items.map((item) => (
            <div key={item.productId} className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary line-clamp-2">
                  {item.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-medium text-primary-600">
                    {formatCurrency(item.price)}
                  </span>
                  <span className="text-xs text-text-muted bg-surface-alt px-1.5 py-0.5 rounded">
                    {siteConfig.store.supportedFormatsLabel}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 text-sm border-t border-border pt-3">
          <div className="flex justify-between text-text-secondary">
            <span>Tạm tính</span>
            <span>{formatCurrency(totalPrice)}</span>
          </div>
          <div className="flex justify-between font-semibold text-text-primary text-base pt-1">
            <span>Tổng cộng</span>
            <span className="text-primary-600">
              {formatCurrency(totalPrice)}
            </span>
          </div>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="bg-white rounded-2xl border border-border p-5">
        <div className="space-y-3 text-sm text-text-secondary">
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-primary-500 flex-shrink-0" />
            <span>Tải ngay sau khi thanh toán</span>
          </div>
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
            <span>Tệp tài liệu số</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-primary-500 flex-shrink-0" />
            <span>Thanh toán an toàn</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Headphones className="w-4 h-4 text-primary-500 flex-shrink-0" />
            <span>Hỗ trợ nếu gặp lỗi tải file</span>
          </div>
        </div>
      </div>

      {/* Note */}
      <p className="text-xs text-text-muted text-center px-2">
        Tài liệu sẽ được cấp sau khi thanh toán thành công.
      </p>
    </div>
  );
}
