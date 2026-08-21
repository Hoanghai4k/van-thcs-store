"use client";

/**
 * Admin resend delivery email button.
 * Operational recovery: resend delivery email for a PAID order.
 */

import { useState } from "react";
import { Mail, Loader2, CheckCircle } from "lucide-react";

interface ResendEmailButtonProps {
  orderId: string;
  orderCode: string;
}

export function ResendEmailButton({ orderId, orderCode }: ResendEmailButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ sent: boolean; error?: string } | null>(null);

  async function handleResend() {
    if (!confirm(`Gửi lại email tài liệu cho đơn hàng ${orderCode}?`)) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/orders/resend-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();
      setResult({ sent: data.success, error: data.error });
    } catch {
      setResult({ sent: false, error: "Lỗi kết nối." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleResend}
        disabled={isLoading || result?.sent}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ${
          result?.sent 
            ? "bg-green-100 text-green-700 cursor-default" 
            : "bg-primary-600 text-white hover:bg-primary-700"
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : result?.sent ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <Mail className="w-4 h-4" />
        )}
        {result?.sent ? "Đã gửi lại thành công" : "Gửi lại email tài liệu"}
      </button>
      {result?.error && (
        <p className="text-sm mt-2 text-red-600 font-medium">
          Lỗi: {result.error}
        </p>
      )}
    </div>
  );
}
