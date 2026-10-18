"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FileText,
  Zap,
  CheckCircle,
  ArrowRight,
  Gift,
  ArrowLeft,
  Clock,
  Sparkles,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getProductAssetUrl } from "@/lib/storage/storage";
import { ProductPdfPreview } from "@/components/product/product-pdf-preview";
import { useBuyNow } from "@/components/product/use-buy-now";
import {
  buildPreviewSubtitle,
  buildFullVersionSummary,
  formatFileFormatLabel,
  getDiscountPercent,
  getProductDetailPath,
} from "@/features/products/preview-landing-utils";
import {
  emitPreviewEvent,
  PREVIEW_EVENTS,
} from "@/features/products/preview-events";
import type {
  PreviewLandingProduct,
  PreviewLandingPreview,
} from "@/features/products/preview-landing";
import { MAX_PREVIEW_PAGES } from "@/lib/constants";

interface PreviewLandingViewProps {
  product: PreviewLandingProduct;
  preview: PreviewLandingPreview | null;
  hasBonus: boolean;
}

export function PreviewLandingView({
  product,
  preview,
  hasBonus,
}: PreviewLandingViewProps) {
  const { buyNow } = useBuyNow(product);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const endOfPreviewRef = useRef<HTMLElement>(null);
  const hasEmittedPage25Ref = useRef(false);

  const discount = getDiscountPercent(product.price, product.original_price);
  const thumbUrl = getProductAssetUrl(product.thumbnail_path);
  const formatLabel = formatFileFormatLabel(product.file_format);

  // Subtitle builder e.g. "Xem trước tối đa 25 trang đầu • Bản đầy đủ 1.478 trang"
  const subtitle = buildPreviewSubtitle({
    previewPageCount: preview?.pageCount ?? null,
    maxPreviewPages: MAX_PREVIEW_PAGES,
    fullPageCount: product.page_count,
  });

  // Emit preview_open on initial mount
  useEffect(() => {
    emitPreviewEvent(PREVIEW_EVENTS.OPEN, {
      productSlug: product.slug,
      totalPages: preview?.pageCount,
    });
  }, [product.slug, preview?.pageCount]);

  function handlePageChange(page: number, total: number) {
    setCurrentPage(page);
    // If reached last preview page (e.g. 25), trigger analytics once
    if (page >= total && !hasEmittedPage25Ref.current) {
      hasEmittedPage25Ref.current = true;
      emitPreviewEvent(PREVIEW_EVENTS.FINAL_PAGE_REACHED, {
        productSlug: product.slug,
        page,
        totalPages: total,
      });
    }
  }

  function handleBuyClick(placement: "sticky_bar" | "end_cta" | "header_cta" | "fallback_cta") {
    emitPreviewEvent(PREVIEW_EVENTS.BUY_CLICKED, {
      productSlug: product.slug,
      page: currentPage,
      totalPages: preview?.pageCount,
      placement,
    });
    buyNow();
  }

  function scrollToEndOfPreview() {
    endOfPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      className="min-h-screen bg-background pb-28 md:pb-20"
      data-product-slug={product.slug}
      data-analytics-event="preview_open"
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between text-xs sm:text-sm text-text-muted">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 hover:text-primary-600 transition-colors py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Tất cả tài liệu</span>
          </Link>
          <Link
            href={getProductDetailPath(product.slug)}
            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium py-1"
          >
            <span>Chi tiết tài liệu</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Compact Product Header — ABOVE THE FOLD HERO */}
        <header className="bg-surface rounded-2xl border border-border p-4 sm:p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              {/* Product Badge */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/40 border border-primary-200 dark:border-primary-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-primary-500" />
                  Bản xem thử
                </span>
                <span className="text-[11px] sm:text-xs font-semibold bg-surface-alt text-text-secondary border border-border px-2 py-0.5 rounded-full">
                  {formatLabel}
                </span>
                {hasBonus && (
                  <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-full">
                    <Gift className="w-3 h-3 text-purple-500" />
                    Có tài liệu tặng kèm
                  </span>
                )}
              </div>

              {/* Product Name */}
              <h1 className="text-lg sm:text-2xl font-bold text-text-primary leading-snug tracking-tight">
                {product.name}
              </h1>

              {/* Subtitle */}
              <p className="text-xs sm:text-sm text-text-muted font-medium flex flex-wrap items-center gap-1.5">
                <span>{subtitle}</span>
              </p>
            </div>

            {/* Optional Small Thumbnail on larger viewports */}
            {thumbUrl && (
              <div className="hidden sm:block relative w-16 h-16 rounded-xl border border-border overflow-hidden flex-shrink-0 bg-surface-alt">
                <Image
                  src={thumbUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
            )}
          </div>
        </header>

        {/* Hero Section: PREVIEW VIEWER OR FALLBACK */}
        {preview && preview.url ? (
          <main className="space-y-4">
            <ProductPdfPreview
              url={preview.url}
              variant="landing"
              maxPages={preview.pageCount || MAX_PREVIEW_PAGES}
              onPageChange={handlePageChange}
              onLastPageNext={scrollToEndOfPreview}
              lastPageNextLabel="Xem bản đầy đủ"
            />
          </main>
        ) : (
          /* Missing Preview Fallback */
          <div className="bg-surface rounded-2xl border border-dashed border-border p-8 sm:p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800/50 flex items-center justify-center mx-auto text-primary-600 dark:text-primary-400">
              <Clock className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-text-primary">
                Bản xem thử đang được cập nhật
              </h2>
              <p className="text-sm text-text-muted">
                Bản xem trước trực tuyến của tài liệu này đang được chuẩn bị. Bạn vẫn có thể mua ngay bản đầy đủ hoặc xem thêm thông tin chi tiết.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleBuyClick("fallback_cta")}
                data-analytics-event="preview_buy_clicked"
                data-placement="fallback_cta"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-xl text-base font-semibold bg-primary-600 text-white hover:bg-primary-700 shadow-sm transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <Zap className="w-5 h-5" />
                Mua bản đầy đủ • {formatCurrency(product.price)}
              </button>
              <Link
                href={getProductDetailPath(product.slug)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-xl text-sm font-semibold border border-border text-text-primary bg-surface hover:bg-surface-hover transition-colors"
              >
                Xem chi tiết sản phẩm
              </Link>
            </div>
          </div>
        )}

        {/* End-of-preview Conversion Section */}
        <section
          ref={endOfPreviewRef}
          id="end-of-preview"
          aria-labelledby="end-preview-heading"
          className="bg-surface rounded-2xl border border-primary-200 dark:border-primary-900/50 p-6 sm:p-8 shadow-md relative overflow-hidden"
        >
          {/* Subtle decorative gradient */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-primary-500/10 via-primary-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto text-center space-y-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/40 border border-primary-200 dark:border-primary-800 px-3 py-1 rounded-full uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" />
                Hoàn tất bản xem thử
              </span>
              <h2
                id="end-preview-heading"
                className="text-xl sm:text-3xl font-extrabold text-text-primary tracking-tight"
              >
                Bạn đã xem hết bản xem thử
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-medium">
                {buildFullVersionSummary(product.page_count, product.file_count)}
              </p>
            </div>

            {/* Price Card */}
            <div className="inline-flex items-baseline justify-center gap-3 p-3 sm:p-4 rounded-2xl bg-surface-alt border border-border">
              <span className="text-2xl sm:text-4xl font-black text-primary-600 tracking-tight">
                {formatCurrency(product.price)}
              </span>
              {product.original_price && product.original_price > product.price && (
                <span className="text-base sm:text-lg text-text-muted line-through">
                  {formatCurrency(product.original_price)}
                </span>
              )}
              {discount && (
                <span className="text-xs font-bold text-error bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                  -{discount}%
                </span>
              )}
            </div>

            {/* Bonus Product Note */}
            {hasBonus && (
              <div className="inline-flex items-center gap-2 p-2.5 px-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/60 text-purple-800 dark:text-purple-300 text-xs sm:text-sm font-semibold">
                <Gift className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>🎁 Có tài liệu tặng kèm (nhận ngay sau khi thanh toán)</span>
              </div>
            )}

            {/* Primary Buy CTA */}
            <div>
              <button
                type="button"
                onClick={() => handleBuyClick("end_cta")}
                data-analytics-event="preview_buy_clicked"
                data-placement="end_cta"
                className="w-full sm:w-auto min-w-[280px] inline-flex items-center justify-center gap-2.5 py-4 px-8 rounded-xl text-base sm:text-lg font-bold bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <Zap className="w-5 h-5" />
                <span>Mua bản đầy đủ</span>
                <ArrowRight className="w-5 h-5 ml-1" />
              </button>
            </div>

            {/* Trust & Benefits */}
            <div className="pt-2 border-t border-border/80">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <div className="flex items-start gap-2 text-xs sm:text-sm text-text-secondary">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span>Tải ngay sau khi thanh toán</span>
                </div>
                <div className="flex items-start gap-2 text-xs sm:text-sm text-text-secondary">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span>File gốc {formatLabel} đầy đủ chỉnh sửa</span>
                </div>
                <div className="flex items-start gap-2 text-xs sm:text-sm text-text-secondary">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span>Thanh toán an toàn qua payOS / VietQR</span>
                </div>
              </div>
            </div>

            {/* Secondary link to product detail */}
            <div className="pt-2">
              <Link
                href={getProductDetailPath(product.slug)}
                className="text-xs sm:text-sm text-text-muted hover:text-primary-600 transition-colors inline-flex items-center gap-1"
              >
                <span>Xem mô tả chi tiết sản phẩm và các câu hỏi thường gặp</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

      </div>

      {/* Sticky Bottom Purchase Bar (Mobile & Desktop) */}
      <aside
        aria-label="Thanh mua nhanh"
        className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-3 py-2.5 sm:px-6 sm:py-3"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Price information */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1.5 sm:gap-2 truncate">
              <span className="text-lg sm:text-2xl font-bold text-primary-600">
                {formatCurrency(product.price)}
              </span>
              {product.original_price && product.original_price > product.price && (
                <span className="text-xs sm:text-sm text-text-muted line-through hidden xs:inline">
                  {formatCurrency(product.original_price)}
                </span>
              )}
            </div>
            {hasBonus ? (
              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 truncate">
                <Gift className="w-3 h-3 shrink-0" />
                <span>Có quà tặng kèm</span>
              </span>
            ) : (
              <span className="text-[11px] text-text-muted truncate">
                Nhận bản đầy đủ {product.page_count ? `${product.page_count} trang` : ""}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBuyClick("sticky_bar")}
              data-analytics-event="preview_buy_clicked"
              data-placement="sticky_bar"
              className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 sm:px-6 rounded-xl text-sm sm:text-base font-bold bg-primary-600 text-white hover:bg-primary-700 shadow-sm transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              <Zap className="w-4 h-4" />
              <span>Mua bản đầy đủ</span>
            </button>
            <Link
              href={getProductDetailPath(product.slug)}
              title="Xem trang chi tiết sản phẩm"
              className="hidden md:inline-flex items-center justify-center min-h-11 px-3 rounded-xl border border-border text-text-secondary hover:bg-surface-hover text-sm font-medium transition-colors"
            >
              <ShoppingBag className="w-4 h-4 mr-1.5" />
              Chi tiết
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
