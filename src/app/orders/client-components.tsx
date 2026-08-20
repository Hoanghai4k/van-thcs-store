"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ORDER_STATUS, type OrderStatus } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/utils";

// ─── Login Form ────────────────────────────────────────────────────────────

export function MyOrdersForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/orders/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || "Lỗi hệ thống");
      }
    } catch {
      setError("Không thể kết nối đến máy chủ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-sm border border-neutral-200">
      <h1 className="text-2xl font-bold mb-4 text-center">Đơn hàng của tôi</h1>
      <p className="text-neutral-600 mb-6 text-center text-sm">
        Nhập email đã dùng khi đặt hàng. Chúng tôi sẽ gửi liên kết xác minh để bạn xem các đơn hàng của mình.
      </p>

      {message && (
        <div className="mb-4 p-3 bg-green-50 text-green-800 rounded border border-green-200 text-sm text-center">
          Nếu email này có đơn hàng, liên kết xác minh đã được gửi.
          <p className="mt-1 text-xs text-green-700">Vui lòng kiểm tra cả mục Spam/Thư rác nếu chưa thấy email.</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded border border-red-200 text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email đã đặt hàng
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-black outline-none"
            placeholder="ví dụ: nguyenvan@example.com"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email}
          className="w-full bg-black text-white font-medium py-2 px-4 rounded-md hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          {loading ? "Đang gửi..." : "Gửi liên kết xác minh"}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-neutral-500">Hoặc</span>
        <br />
        <Link href="/order/lookup" className="text-primary-600 hover:underline font-medium inline-block mt-2">
          Tra cứu bằng mã đơn hàng
        </Link>
      </div>
    </div>
  );
}

// ─── Order List ────────────────────────────────────────────────────────────

type OrderListProps = {
  email: string;
  orders: Array<{
    id: string;
    orderCode: string;
    totalAmount: number;
    status: OrderStatus;
    createdAt: string;
    items: Array<{ productName: string }>;
    latestPaymentAttemptStatus?: string;
  }>;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FAILED: "Thanh toán lỗi",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};

export function MyOrdersList({ email, orders }: OrderListProps) {
  const router = useRouter();
  const [loadingCode, setLoadingCode] = useState<string | null>(null);

  const handleLogout = async () => {
    await fetch("/api/orders/logout", { method: "POST" });
    router.refresh();
  };

  const handleOpenOrder = async (orderCode: string) => {
    setLoadingCode(orderCode);
    try {
      const res = await fetch("/api/orders/grant-order-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode }),
      });
      const data = await res.json();
      if (res.ok && data.data?.redirectUrl) {
        router.push(data.data.redirectUrl);
      } else {
        alert(data.error || "Không thể xem đơn hàng");
      }
    } catch {
      alert("Lỗi mạng");
    } finally {
      setLoadingCode(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between bg-neutral-50 p-4 rounded-xl border border-neutral-200">
        <div>
          <h1 className="text-xl font-bold">Đơn hàng của tôi</h1>
          <p className="text-sm text-neutral-600">Đang xem đơn hàng của: <span className="font-medium text-black">{email.replace(/(.{2})(.*)(@.*)/, "$1***$3")}</span></p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3 items-center">
          <Link href="/order/lookup" className="text-sm font-medium text-primary-600 hover:underline py-2 px-3">
            Tra cứu mã đơn
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-text-secondary hover:text-text-primary py-2 px-3 transition-colors"
          >
            Dùng email khác
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-neutral-200">
          <p className="text-text-primary mb-4 font-medium">Chưa có đơn hàng nào với email này.</p>
          <Link href="/products" className="inline-block bg-primary-600 text-white font-medium py-2 px-6 rounded-md hover:bg-primary-700 transition-colors">
            Xem tài liệu
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <div key={order.orderCode} className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-lg">{order.orderCode}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      order.status === ORDER_STATUS.PAID
                        ? "bg-green-100 text-green-800"
                        : order.status === ORDER_STATUS.PENDING
                        ? "bg-yellow-100 text-yellow-800"
                        : order.status === ORDER_STATUS.CANCELLED
                        ? "bg-neutral-100 text-neutral-600"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
                <p className="text-sm text-neutral-500">
                  {formatDateTime(order.createdAt)}
                </p>
                <div className="text-sm text-neutral-700">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="truncate max-w-md">• {item.productName}</div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col md:items-end justify-between gap-3 shrink-0">
                <div className="font-bold text-lg">
                  {formatCurrency(order.totalAmount)}
                </div>
                <button
                  onClick={() => handleOpenOrder(order.orderCode)}
                  disabled={loadingCode === order.orderCode}
                  className="bg-primary-600 text-white font-medium py-2.5 px-6 rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors whitespace-nowrap min-w-[200px]"
                >
                  {loadingCode === order.orderCode
                    ? "Đang tải..."
                    : order.status === ORDER_STATUS.PAID
                    ? "Xem / Nhận tài liệu"
                    : order.status === ORDER_STATUS.REFUNDED
                    ? "Xem đơn"
                    : (order.latestPaymentAttemptStatus === "CANCELLED" || order.latestPaymentAttemptStatus === "EXPIRED")
                    ? "Xem / Thanh toán lại"
                    : "Xem / Thanh toán"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
