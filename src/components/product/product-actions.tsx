"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Check, Zap, ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/cart/cart-provider";
import type { ProductWithCategory } from "@/features/products/types";

interface ProductActionsProps {
  product: ProductWithCategory;
  /** Whether a derived preview PDF exists for this product */
  hasPreview?: boolean;
}

/**
 * Dual CTA for product detail: "Mua ngay" + "Thêm vào giỏ hàng".
 * - Buy Now: adds to cart → redirects to /checkout
 * - Add to Cart: adds to cart → shows inline feedback
 * - Already in cart: shows "Đã trong giỏ" + link to cart
 *
 * For PAID products with a preview, a mobile-only "Xem thử tài liệu"
 * link is rendered below the purchase buttons. It opens the stable
 * preview endpoint in a new tab (no react-pdf, no previewUrl dependency).
 */
export function ProductActions({ product, hasPreview }: ProductActionsProps) {
  const { addItem, isInCart } = useCart();
  const router = useRouter();
  const inCart = isInCart(product.id);
  const [justAdded, setJustAdded] = useState(false);

  const showMobilePreview =
    hasPreview === true && product.product_type === "PAID";

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

  // Mobile preview CTA — rendered in the same card as "Mua ngay"
  const mobilePreviewCta = showMobilePreview ? (
    <div className="md:hidden pt-1 space-y-1.5">
      <a
        href={`/api/products/${product.id}/preview`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-sm font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 transition-all active:scale-[0.98]"
        data-testid="mobile-preview-cta"
      >
        <ExternalLink className="w-4 h-4" />
        Xem thử tài liệu
      </a>
      <p className="text-xs text-text-muted text-center">
        Xem trước tối đa 25 trang đầu.
      </p>
    </div>
  ) : null;

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
        {mobilePreviewCta}
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
        {mobilePreviewCta}
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
      {mobilePreviewCta}
    </div>
  );
}
