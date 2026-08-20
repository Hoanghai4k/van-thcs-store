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
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : result?.sent ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <Mail className="w-4 h-4" />
        )}
        Gửi lại email tài liệu
      </button>
      {result && (
        <p className={`text-xs mt-1 ${result.sent ? "text-green-600" : "text-red-600"}`}>
          {result.sent ? "Email đã được gửi." : result.error ?? "Gửi email thất bại."}
        </p>
      )}
    </div>
  );
}
