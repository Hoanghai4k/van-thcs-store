"use client";

/**
 * Resume Payment Button.
 *
 * Client component that calls /api/orders/resume-payment
 * to get a payOS checkout URL and redirects the customer.
 *
 * SECURITY: This component NEVER sets order status.
 * It only initiates a new payment attempt for an existing PENDING order.
 */

import { useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ResumePaymentButtonProps {
  orderCode: string;
  totalAmount: number;
  isRetry?: boolean;
}

export function ResumePaymentButton({ orderCode, totalAmount, isRetry }: ResumePaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResume() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/orders/resume-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode }),
      });

      const result = await response.json();

      if (result.success && result.data?.checkoutUrl) {
        // Redirect to payOS checkout
        window.location.href = result.data.checkoutUrl;
        return; // Keep loading while redirecting
      }

      setError(result.error || "Chưa thể tạo lại thanh toán. Vui lòng thử lại sau.");
      setIsLoading(false);
    } catch {
      setError("Chưa thể tạo lại thanh toán. Vui lòng thử lại sau.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleResume}
        disabled={isLoading}
        className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Đang tạo phiên thanh toán mới...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            {isRetry ? "Thanh toán lại" : "Tiếp tục thanh toán"} — {formatCurrency(totalAmount)}
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-sm text-error text-center">{error}</p>
      )}
    </div>
  );
}
