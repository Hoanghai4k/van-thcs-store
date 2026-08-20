"use client";

/**
 * Delivery button component for PAID orders.
 *
 * Triggers server action to create/ensure delivery grant and
 * redirect to the downloads page.
 *
 * SECURITY:
 * - Server action verifies order is PAID before granting delivery
 * - Order Access Cookie alone does NOT authorize downloads
 * - Separate Delivery Access Cookie is issued server-side
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";

interface DeliveryButtonProps {
  orderCode: string;
  orderId: string;
}

export function DeliveryButton({ orderCode, orderId }: DeliveryButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/delivery/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, orderCode }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Không thể truy cập tài liệu.");
        setIsLoading(false);
        return;
      }

      // Redirect to downloads page
      router.push(`/order/${orderCode}/downloads`);
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Download className="w-5 h-5" />
        )}
        Nhận tài liệu
      </button>
      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
    </div>
  );
}
