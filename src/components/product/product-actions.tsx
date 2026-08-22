"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Check, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/cart/cart-provider";
import type { ProductWithCategory } from "@/features/products/types";

interface ProductActionsProps {
  product: ProductWithCategory;
}

/**
 * Dual CTA for product detail: "Mua ngay" + "Thêm vào giỏ hàng".
 * - Buy Now: adds to cart → redirects to /checkout
 * - Add to Cart: adds to cart → shows inline feedback
 * - Already in cart: shows "Đã trong giỏ" + link to cart
 */
export function ProductActions({ product }: ProductActionsProps) {
  const { addItem, isInCart } = useCart();
  const router = useRouter();
  const inCart = isInCart(product.id);
  const [justAdded, setJustAdded] = useState(false);

  if (product.product_type === "FREE") {
    return (
      <div className="space-y-3">
        <a
          href={`#free-download-section`} // Anchor to the free files block
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-base font-semibold bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
        >
          Tải tài liệu miễn phí
          <ArrowRight className="w-5 h-5" />
        </a>
      </div>
    );
  }

  function addToCartItem() {
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      originalPrice: product.original_price,
      thumbnailPath: product.thumbnail_path,
      productType: product.product_type,
    });
  }

  function handleBuyNow() {
    if (!inCart) {
      addToCartItem();
    }
    router.push("/checkout");
  }

  function handleAddToCart() {
    if (inCart) return;
    addToCartItem();
    setJustAdded(true);
  }

  // Already in cart state
  if (inCart && !justAdded) {
    return (
      <div className="space-y-3">
        <button
          onClick={handleBuyNow}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-base font-semibold bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
        >
          <Zap className="w-5 h-5" />
          Mua ngay
        </button>
        <div className="flex items-center justify-center gap-2 py-3 text-green-600 text-sm font-medium">
          <Check className="w-4 h-4" />
          Đã trong giỏ hàng
          <span className="text-text-muted">·</span>
          <Link
            href="/cart"
            className="text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
          >
            Xem giỏ hàng
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Just added feedback state
  if (justAdded) {
    return (
      <div className="space-y-3">
        <button
          onClick={handleBuyNow}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-base font-semibold bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
        >
          <Zap className="w-5 h-5" />
          Mua ngay
        </button>
        <div className="flex items-center justify-center gap-2 py-3 text-green-600 text-sm font-medium animate-in fade-in">
          <Check className="w-4 h-4" />
          Đã thêm vào giỏ hàng
          <span className="text-text-muted">·</span>
          <Link
            href="/cart"
            className="text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
          >
            Xem giỏ hàng
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Default: both CTAs available
  return (
    <div className="space-y-3">
      <button
        onClick={handleBuyNow}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-base font-semibold bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
      >
        <Zap className="w-5 h-5" />
        Mua ngay
      </button>
      <button
        onClick={handleAddToCart}
        className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-base font-medium border-2 border-primary-200 text-primary-600 hover:bg-primary-50 hover:border-primary-300 transition-all active:scale-[0.98]"
      >
        <ShoppingCart className="w-5 h-5" />
        Thêm vào giỏ hàng
      </button>
    </div>
  );
}
