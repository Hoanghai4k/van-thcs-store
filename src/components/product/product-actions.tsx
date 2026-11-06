"use client";

import { useState } from "react";
import { ShoppingCart, Check, Zap, ArrowRight, ExternalLink, BookOpen, Clock } from "lucide-react";
import Link from "next/link";
import { useBuyNow } from "@/components/product/use-buy-now";
import type { ProductWithCategory } from "@/features/products/types";
import type { ProductAccessState } from "@/features/products/access-state";

interface ProductActionsProps {
  product: ProductWithCategory;
  isEntitled?: boolean;
  accessState?: ProductAccessState;
}

/**
 * Dual CTA for product detail: "Mua ngay" + "Thêm vào giỏ hàng".
 * - Buy Now: adds to cart → redirects to /checkout (shared useBuyNow flow)
 * - Add to Cart: adds to cart → shows inline feedback
 * - Already in cart: shows "Đã trong giỏ" + link to cart
 * - Entitled customer: displays "Xem bản đầy đủ" link to /account/library/[slug]
 *
 * For PAID products, a mobile-only "Xem thử tài liệu" link is always
 * rendered below the purchase buttons. It opens the stable preview
 * endpoint in a new tab (no react-pdf, no previewUrl dependency).
 * The endpoint itself handles whether a preview exists.
 */
export function ProductActions({ product, isEntitled, accessState }: ProductActionsProps) {
  const { inCart, addToCart: addToCartItem, buyNow: handleBuyNow } = useBuyNow(product);
  const [justAdded, setJustAdded] = useState(false);

  const isOwner = accessState ? accessState.isEntitled : !!isEntitled;
  const isViewerReady = accessState ? accessState.viewerReady : true;
  const isAuthenticated = accessState ? accessState.isAuthenticated : false;

  const showMobilePreview = product.product_type === "PAID";

  function handleAddToCart() {
    if (inCart) return;
    addToCartItem();
    setJustAdded(true);
  }

  // Mobile preview CTA — rendered in the same card as "Mua ngay"
  const mobilePreviewCta = showMobilePreview ? (
    <div className="md:hidden pb-1 space-y-1.5">
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

  // Entitled Customer Full Viewer CTA
  const entitledFullViewerCta = isOwner && product.slug ? (
    <div className="pb-1 space-y-1.5">
      <Link
        href={`/account/library/${product.slug}`}
        className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow transition-all active:scale-[0.98]"
        data-testid="entitled-full-viewer-cta"
      >
        <BookOpen className="w-4 h-4" />
        <span>Xem bản đầy đủ trong Thư viện</span>
      </Link>
      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium text-center">
        ✓ Bạn đã sở hữu tài liệu này
      </p>
    </div>
  ) : null;

  // Unauthenticated customer prompt to login if already purchased
  const loginPrompt = !isAuthenticated && product.slug ? (
    <div className="text-center pt-1">
      <p className="text-xs text-text-muted">
        Đã mua tài liệu này?{" "}
        <Link
          href={`/login?redirect=${encodeURIComponent(`/account/library/${product.slug}`)}`}
          className="text-primary-600 hover:text-primary-700 font-medium underline underline-offset-2"
        >
          Đăng nhập để xem
        </Link>
      </p>
    </div>
  ) : null;

  // Entitled Owner Branch
  if (isOwner) {
    if (isViewerReady) {
      return (
        <div className="space-y-3">
          {entitledFullViewerCta}
          {product.slug && (
            <Link
              href={`/xem-thu/${product.slug}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-sm font-semibold text-text-secondary bg-surface-alt hover:bg-surface border border-border transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Xem lại bản xem thử</span>
            </Link>
          )}
        </div>
      );
    }

    // Entitled but artifact is preparing
    return (
      <div className="space-y-3">
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-sm">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <Clock className="w-4 h-4" />
            <span>✓ Bạn đã sở hữu tài liệu này</span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Tài liệu đang được chuẩn bị để xem. Vui lòng quay lại Thư viện của bạn sau ít phút.
          </p>
        </div>
        {product.slug && (
          <Link
            href={`/xem-thu/${product.slug}`}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-sm font-semibold text-text-secondary bg-surface-alt hover:bg-surface border border-border transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Xem trước bản xem thử</span>
          </Link>
        )}
      </div>
    );
  }

  // Already in cart state
  if (inCart && !justAdded) {
    return (
      <div className="space-y-3">
        {entitledFullViewerCta}
        {mobilePreviewCta}
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
        {loginPrompt}
      </div>
    );
  }

  // Just added feedback state
  if (justAdded) {
    return (
      <div className="space-y-3">
        {entitledFullViewerCta}
        {mobilePreviewCta}
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
        {loginPrompt}
      </div>
    );
  }

  // Default: both CTAs available
  return (
    <div className="space-y-3">
      {entitledFullViewerCta}
      {mobilePreviewCta}
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
      {loginPrompt}
    </div>
  );
}
