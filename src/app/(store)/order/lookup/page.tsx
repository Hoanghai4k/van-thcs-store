"use client";

import { useState } from "react";
import { Search, Loader2, CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
import { siteConfig } from "@/config/site";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface OrderResult {
  orderCode: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  paidAt: string | null;
  items: Array<{ productName: string; unitPrice: number }>;
}

export default function OrderLookupPage() {
  const [orderCode, setOrderCode] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setOrder(null);

    try {
      const res = await fetch(`/api/orders/lookup?orderCode=${encodeURIComponent(orderCode)}&email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Không tìm thấy đơn hàng.");
      } else {
        setOrder(data.data);
      }
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  }

  const statusConfig = order ? getStatusDisplay(order.status) : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-text-primary mb-2 text-center">Tra cứu đơn hàng</h1>
      <p className="text-text-secondary text-center mb-8">
        Nhập mã đơn hàng và email để kiểm tra trạng thái đơn hàng.
      </p>

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
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Tra cứu
        </button>
      </form>

      {/* Order Result */}
      {order && statusConfig && (
        <div className="mt-6 bg-white rounded-2xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusConfig.bgColor}`}>
              <statusConfig.Icon className={`w-5 h-5 ${statusConfig.iconColor}`} />
            </div>
            <div>
              <p className="font-semibold text-text-primary">{order.orderCode}</p>
              <p className={`text-sm font-medium ${statusConfig.textColor}`}>{statusConfig.label}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Ngày đặt</span>
              <span className="text-text-primary">{formatDateTime(order.createdAt)}</span>
            </div>
            {order.paidAt && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Ngày thanh toán</span>
                <span className="text-text-primary">{formatDateTime(order.paidAt)}</span>
              </div>
            )}

            <div className="border-t border-border pt-3 mt-3">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1">
                  <span className="text-text-primary">{item.productName}</span>
                  <span className="text-text-secondary">{formatCurrency(item.unitPrice)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-3">
              <div className="flex justify-between font-semibold">
                <span>Tổng cộng</span>
                <span className="text-primary-600">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-text-muted text-center mt-4">
        Cần hỗ trợ? Liên hệ {siteConfig.contact.email}
      </p>
    </div>
  );
}

function getStatusDisplay(status: string) {
  switch (status) {
    case "PAID":
      return { Icon: CheckCircle, label: "Đã thanh toán", bgColor: "bg-green-100", iconColor: "text-green-600", textColor: "text-green-600" };
    case "PENDING":
      return { Icon: Clock, label: "Chờ thanh toán", bgColor: "bg-yellow-100", iconColor: "text-yellow-600", textColor: "text-yellow-600" };
    case "CANCELLED":
      return { Icon: XCircle, label: "Đã hủy", bgColor: "bg-gray-100", iconColor: "text-gray-500", textColor: "text-gray-500" };
    case "FAILED":
      return { Icon: AlertTriangle, label: "Thất bại", bgColor: "bg-red-100", iconColor: "text-red-600", textColor: "text-red-600" };
    default:
      return { Icon: Clock, label: status, bgColor: "bg-gray-100", iconColor: "text-gray-500", textColor: "text-gray-500" };
  }
}
