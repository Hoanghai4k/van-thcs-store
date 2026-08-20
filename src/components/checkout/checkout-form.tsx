"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { checkoutFormSchema, type CheckoutFormFields } from "@/features/orders/schema";
import type { CartItem } from "@/types/common";

interface CheckoutFormProps {
  items: CartItem[];
  totalPrice: number;
  onOrderCreated: (orderCode: string) => void;
}

interface FieldErrors {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

/**
 * Checkout form with client-side Zod validation and Vietnamese error messages.
 * Validates name, email, phone before submitting to the server.
 * Server recalculates price from productIds — client price is display-only.
 *
 * On successful order creation, redirects to payOS hosted checkout.
 */
export function CheckoutForm({
  items,
  totalPrice,
  onOrderCreated,
}: CheckoutFormProps) {
  const [form, setForm] = useState<CheckoutFormFields>({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm(): boolean {
    const result = checkoutFormSchema.safeParse(form);
    if (result.success) {
      setFieldErrors({});
      return true;
    }

    const errors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof FieldErrors;
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    setFieldErrors(errors);
    return false;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) return;
    if (isSubmitting) return; // Prevent double-click

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          productIds: items.map((i) => i.productId),
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        // If payment provider returned a checkout URL, redirect
        if (result.data.checkoutUrl) {
          window.location.href = result.data.checkoutUrl;
          return; // Keep spinner while redirecting
        }
        // Fallback: show order created (provider not configured)
        onOrderCreated(result.data.orderCode);
      } else {
        setServerError(result.error || "Chưa thể tạo đơn hàng. Vui lòng thử lại.");
        setIsSubmitting(false);
      }
    } catch {
      setServerError("Chưa thể tạo đơn hàng. Vui lòng thử lại.");
      setIsSubmitting(false);
    }
  }

  function handleChange(field: keyof CheckoutFormFields, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="font-semibold text-text-primary mb-4">
          Thông tin khách hàng
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="checkout-name"
              className="block text-sm font-medium text-text-primary mb-1.5"
            >
              Họ và tên <span className="text-error">*</span>
            </label>
            <input
              id="checkout-name"
              type="text"
              value={form.customerName}
              onChange={(e) => handleChange("customerName", e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all text-sm ${
                fieldErrors.customerName
                  ? "border-error focus:ring-2 focus:ring-red-200"
                  : "border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              }`}
              placeholder="Nguyễn Văn A"
            />
            {fieldErrors.customerName && (
              <p className="mt-1.5 text-sm text-error flex items-start gap-1">
                <span className="shrink-0">⚠</span>
                {fieldErrors.customerName}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="checkout-email"
              className="block text-sm font-medium text-text-primary mb-1.5"
            >
              Email <span className="text-error">*</span>
            </label>
            <input
              id="checkout-email"
              type="email"
              value={form.customerEmail}
              onChange={(e) => handleChange("customerEmail", e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all text-sm ${
                fieldErrors.customerEmail
                  ? "border-error focus:ring-2 focus:ring-red-200"
                  : "border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              }`}
              placeholder="email@example.com"
            />
            {fieldErrors.customerEmail && (
              <p className="mt-1.5 text-sm text-error flex items-start gap-1">
                <span className="shrink-0">⚠</span>
                {fieldErrors.customerEmail}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="checkout-phone"
              className="block text-sm font-medium text-text-primary mb-1.5"
            >
              Số điện thoại <span className="text-error">*</span>
            </label>
            <input
              id="checkout-phone"
              type="tel"
              value={form.customerPhone}
              onChange={(e) => handleChange("customerPhone", e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all text-sm ${
                fieldErrors.customerPhone
                  ? "border-error focus:ring-2 focus:ring-red-200"
                  : "border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              }`}
              placeholder="0912345678"
            />
            {fieldErrors.customerPhone && (
              <p className="mt-1.5 text-sm text-error flex items-start gap-1">
                <span className="shrink-0">⚠</span>
                {fieldErrors.customerPhone}
              </p>
            )}
          </div>
        </div>
      </div>

      {serverError && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm flex items-start gap-2">
          <span className="shrink-0">⚠</span>
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Đang tạo thanh toán...
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5" />
            Tiếp tục thanh toán — {formatCurrency(totalPrice)}
          </>
        )}
      </button>

      <p className="text-xs text-text-muted text-center space-y-1">
        <span className="block">Bạn sẽ được chuyển sang trang thanh toán VietQR.</span>
        <span className="block">Sau khi thanh toán thành công, bạn sẽ quay lại Tài Liệu Hằng Cao để nhận tài liệu.</span>
      </p>
    </form>
  );
}
