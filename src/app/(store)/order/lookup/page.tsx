"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, ShieldCheck } from "lucide-react";

export default function OrderLookupPage() {
  return (
    <Suspense fallback={<OrderLookupSkeleton />}>
      <OrderLookupForm />
    </Suspense>
  );
}

function OrderLookupSkeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Tra cứu đơn hàng</h1>
        <p className="text-text-secondary">
          Nhập mã đơn hàng và email đã dùng khi đặt hàng.
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4 animate-pulse">
        <div className="h-10 bg-surface-alt rounded-xl" />
        <div className="h-10 bg-surface-alt rounded-xl" />
        <div className="h-12 bg-primary-200 rounded-xl" />
      </div>
    </div>
  );
}

function OrderLookupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Prefill orderCode from URL query param (e.g., redirected from /order/[orderCode])
  const initialOrderCode = searchParams.get("orderCode") ?? "";
  const [orderCode, setOrderCode] = useState(initialOrderCode);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/lookup?orderCode=${encodeURIComponent(orderCode)}&email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Không thể xác minh thông tin đơn hàng. Vui lòng kiểm tra lại mã đơn và email.");
        setIsLoading(false);
      } else {
        // Cookie was set by the API — redirect to the protected order page
        router.push(`/order/${data.data.orderCode}`);
      }
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Tra cứu đơn hàng</h1>
        <p className="text-text-secondary">
          Nhập mã đơn hàng và email đã dùng khi đặt hàng.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div>
          <label htmlFor="lookup-order-code" className="block text-sm font-medium text-text-primary mb-1.5">
            Mã đơn hàng
          </label>
          <input
            id="lookup-order-code"
            type="text"
            required
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm"
            placeholder="VTS-20240101-XXXXX"
          />
        </div>
        <div>
          <label htmlFor="lookup-email" className="block text-sm font-medium text-text-primary mb-1.5">
            Email đã đặt hàng
          </label>
          <input
            id="lookup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm"
            placeholder="email@example.com"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white font-medium py-3 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang tra cứu...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Tra cứu
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm space-y-3">
        <p className="text-text-secondary">
          Không nhớ mã đơn?{" "}
          <a href="/orders" className="text-primary-600 font-medium hover:underline">
            Xem Đơn hàng của tôi
          </a>
        </p>
        <p className="text-text-muted text-xs">
          Cần hỗ trợ? <a href="/contact" className="hover:underline">Liên hệ với chúng tôi</a>
        </p>
      </div>
    </div>
  );
}
