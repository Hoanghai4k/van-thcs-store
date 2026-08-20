"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/cart-provider";
import { ShoppingBag, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { CheckoutOrderSummary } from "@/components/checkout/checkout-order-summary";

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const router = useRouter();

  // When order is created without a checkout URL (provider unconfigured),
  // redirect to the order status page instead of showing a stale message.
  useEffect(() => {
    if (orderCode) {
      clearCart();
      router.push(`/order/${orderCode}`);
    }
  }, [orderCode, clearCart, router]);

  // Empty cart — not yet ordered
  if (items.length === 0 && !orderCode) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-surface-alt rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="w-10 h-10 text-text-muted" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-3">
          Chưa có sản phẩm để thanh toán
        </h1>
        <p className="text-text-secondary mb-6">
          Hãy thêm tài liệu vào giỏ hàng trước khi thanh toán.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-primary-600 text-white font-medium px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors"
        >
          Xem sản phẩm
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // Redirecting to order status page
  if (orderCode) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
        <p className="text-text-secondary">Đang chuyển hướng...</p>
      </div>
    );
  }

  function handleOrderCreated(code: string) {
    setOrderCode(code);
  }

  // Checkout form
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-8">
        Thanh toán
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Form */}
        <div className="lg:col-span-3">
          <CheckoutForm
            items={items}
            totalPrice={totalPrice}
            onOrderCreated={handleOrderCreated}
          />
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-2">
          <CheckoutOrderSummary />
        </div>
      </div>
    </div>
  );
}
