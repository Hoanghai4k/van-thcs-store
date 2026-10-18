"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, RefreshCcw } from "lucide-react";
import { clampPreviewPageCount } from "@/features/products/preview-landing-utils";

// Setup worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 * - "embedded": original product-detail viewer (fixed-height scroll box). Default.
 * - "landing":  preview-first funnel viewer (/xem-thu/[slug]) — auto height,
 *               sticky toolbar, large tap targets, page picker, keyboard +
 *               swipe navigation, end-of-preview hand-off.
 */
export type PdfPreviewVariant = "embedded" | "landing";

export interface ProductPdfPreviewProps {
  url: string;
  variant?: PdfPreviewVariant;
  /**
   * Defense-in-depth cap on navigable pages. The preview artifact itself
   * already contains at most MAX_PREVIEW_PAGES pages; this never hides
   * pages of a larger document.
   */
  maxPages?: number;
  onDocumentReady?: (totalPages: number) => void;
  onPageChange?: (page: number, totalPages: number) => void;
  /** Landing only: invoked when the visitor presses "next" on the final preview page. */
  onLastPageNext?: () => void;
  lastPageNextLabel?: string;
}

/**
 * Hook to track a container element's width, updating on resize.
 */
function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setWidth(el.clientWidth);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}

const SWIPE_MIN_DISTANCE_PX = 60;

export function ProductPdfPreviewInner({
  url,
  variant = "embedded",
  maxPages,
  onDocumentReady,
  onPageChange,
  onLastPageNext,
  lastPageNextLabel = "Tiếp tục",
}: ProductPdfPreviewProps) {
  const isLanding = variant === "landing";

  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Landing: keep the last rendered page height while the next page renders (no layout jump)
  const [pageMinHeight, setPageMinHeight] = useState<number>();

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerWidth = useContainerWidth(containerRef);

  // Padding inside the PDF view area (p-4 = 16px each side on mobile, p-8 = 32px on sm+)
  // We use a conservative value that works for both
  // Landing uses tighter padding (p-2 / sm:p-6) so the page fills small screens.
  const padding = isLanding
    ? containerWidth < 640 ? 16 : 48
    : containerWidth < 640 ? 32 : 64;
  const pageWidth = containerWidth > 0 ? Math.floor((containerWidth - padding) * scale) : undefined;

  const totalPages = numPages !== undefined ? clampPreviewPageCount(numPages, maxPages) : undefined;
  const isLastPage = totalPages !== undefined && pageNumber >= totalPages;

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    const total = clampPreviewPageCount(numPages, maxPages);
    setNumPages(numPages);
    setPageNumber(1);
    onDocumentReady?.(total);
    if (total > 0) onPageChange?.(1, total);
  }

  const goToPage = useCallback(
    (target: number) => {
      const max = totalPages || 1;
      const next = Math.min(max, Math.max(1, target));
      setPageNumber(next);
      if (totalPages) onPageChange?.(next, totalPages);

      // Landing: if the visitor scrolled down a tall page, bring the new page's top into view
      if (isLanding && !isFullscreen) {
        const el = viewerRef.current;
        if (el && el.getBoundingClientRect().top < 0) {
          el.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      }
    },
    [totalPages, onPageChange, isLanding, isFullscreen],
  );

  const previousPage = useCallback(() => goToPage(pageNumber - 1), [goToPage, pageNumber]);
  const nextPage = useCallback(() => goToPage(pageNumber + 1), [goToPage, pageNumber]);
  const zoomIn = () => {
    setPageMinHeight(undefined);
    setScale(s => Math.min(2.5, +(s + 0.2).toFixed(1)));
  };
  const zoomOut = () => {
    setPageMinHeight(undefined);
    setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)));
  };

  const resetZoom = useCallback(() => {
    setPageMinHeight(undefined);
    setScale(1.0);
  }, []);

  // Landing: ←/→ keyboard navigation (ignored while typing or when zoomed in, where arrows scroll)
  useEffect(() => {
    if (!isLanding) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (scale > 1) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextPage();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        previousPage();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isLanding, scale, nextPage, previousPage]);

  // Landing: lightweight horizontal swipe (no dependency). Disabled when zoomed in.
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (!isLanding || scale > 1) return;
    const t = e.touches[0];
    touchStartRef.current = t ? { x: t.clientX, y: t.clientY } : null;
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!isLanding || !start || scale > 1) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) nextPage();
    else previousPage();
  }

  function handlePageRenderSuccess() {
    if (!isLanding) return;
    const pageEl = pageWrapperRef.current?.querySelector<HTMLElement>(".react-pdf__Page");
    const height = pageEl?.getBoundingClientRect().height;
    if (height && height > 0) setPageMinHeight(Math.round(height));
  }

  function handleLastPageNext() {
    if (onLastPageNext) onLastPageNext();
  }

  // ─── Embedded variant (product detail page) — original markup ──────
  if (!isLanding) {
    return (
      <div className={`flex flex-col bg-surface border border-border rounded-xl overflow-hidden ${isFullscreen ? "fixed inset-0 z-50 rounded-none bg-black/90 border-none" : ""}`}>
        {/* Toolbar */}
        <div className={`flex flex-wrap items-center justify-between gap-2 p-2 sm:p-3 border-b ${isFullscreen ? "border-white/10 bg-black text-white" : "border-border bg-surface-alt"}`}>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button 
                onClick={previousPage} 
                disabled={pageNumber <= 1}
                className={`p-1.5 rounded-lg transition-colors ${pageNumber <= 1 ? "opacity-50 cursor-not-allowed" : isFullscreen ? "hover:bg-white/10" : "hover:bg-surface-hover"}`}
                title="Trang trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium min-w-[3rem] text-center whitespace-nowrap">
                {pageNumber} / {totalPages || "-"}
              </span>
              <button 
                onClick={nextPage} 
                disabled={pageNumber >= (totalPages || 1)}
                className={`p-1.5 rounded-lg transition-colors ${pageNumber >= (totalPages || 1) ? "opacity-50 cursor-not-allowed" : isFullscreen ? "hover:bg-white/10" : "hover:bg-surface-hover"}`}
                title="Trang sau"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="h-6 w-px bg-border hidden sm:block"></div>
            
            {/* Zoom controls — visible on all viewports */}
            <div className="flex items-center gap-1">
              <button 
                onClick={zoomOut}
                disabled={scale <= 0.5}
                className={`p-1.5 rounded-lg transition-colors ${scale <= 0.5 ? "opacity-50 cursor-not-allowed" : isFullscreen ? "hover:bg-white/10" : "hover:bg-surface-hover"}`}
                title="Thu nhỏ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={resetZoom}
                className={`text-xs font-medium min-w-[2.5rem] text-center px-1 py-0.5 rounded transition-colors ${isFullscreen ? "hover:bg-white/10" : "hover:bg-surface-hover"}`}
                title="Đặt lại zoom"
              >
                {Math.round(scale * 100)}%
              </button>
              <button 
                onClick={zoomIn}
                disabled={scale >= 2.5}
                className={`p-1.5 rounded-lg transition-colors ${scale >= 2.5 ? "opacity-50 cursor-not-allowed" : isFullscreen ? "hover:bg-white/10" : "hover:bg-surface-hover"}`}
                title="Phóng to"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-1.5 rounded-lg transition-colors ${isFullscreen ? "hover:bg-white/10" : "hover:bg-surface-hover"}`}
            title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        
        {/* PDF View */}
        <div 
          ref={containerRef}
          className={`relative overflow-auto flex justify-center bg-gray-100 dark:bg-black/50 p-4 sm:p-8 ${isFullscreen ? "h-[calc(100vh-60px)]" : "h-[50vh] sm:h-[600px]"}`}
        >
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p>Đang tải bản xem trước...</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center h-full text-red-500">
                <p>Không thể tải bản xem trước PDF.</p>
              </div>
            }
            className="flex justify-center shadow-lg"
          >
            <Page 
              pageNumber={pageNumber} 
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="border border-border/50 bg-white max-w-full"
            />
          </Document>
        </div>
      </div>
    );
  }

  // ─── Landing variant (/xem-thu/[slug]) ─────────────────────────────
  const progressPercent = totalPages ? Math.round((pageNumber / totalPages) * 100) : 0;
  const iconBtn =
    "inline-flex items-center justify-center min-w-11 min-h-11 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40 disabled:cursor-not-allowed";
  const iconBtnTone = isFullscreen ? "hover:bg-white/10 text-white" : "hover:bg-surface-hover text-text-primary";

  return (
    <div
      ref={viewerRef}
      role="region"
      aria-label="Trình xem thử tài liệu"
      aria-roledescription="trình xem PDF"
      className={`flex flex-col scroll-mt-20 ${isFullscreen ? "fixed inset-0 z-50 bg-black/95" : "bg-surface border border-border rounded-2xl shadow-sm"}`}
    >
      {/* Toolbar — sticky under the site header while scrolling a tall page */}
      <div
        className={`z-20 border-b ${isFullscreen ? "border-white/10 bg-black text-white" : "sticky top-16 rounded-t-2xl border-border bg-surface/95 backdrop-blur-md"}`}
      >
        <div className="flex items-center justify-between gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5">
          {/* Page navigation */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={previousPage}
              disabled={pageNumber <= 1}
              className={`${iconBtn} ${iconBtnTone}`}
              aria-label="Trang trước"
              title="Trang trước (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <label className="sr-only" htmlFor="preview-page-select">
              Chọn trang xem thử
            </label>
            <select
              id="preview-page-select"
              value={pageNumber}
              onChange={(e) => goToPage(Number(e.target.value))}
              disabled={!totalPages}
              className={`min-h-11 rounded-xl border px-2 text-sm font-semibold tabular-nums cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isFullscreen ? "border-white/20 bg-black text-white" : "border-border bg-surface text-text-primary"}`}
            >
              {totalPages ? (
                Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} / {totalPages}
                  </option>
                ))
              ) : (
                <option value={1}>– / –</option>
              )}
            </select>

            <button
              type="button"
              onClick={nextPage}
              disabled={!totalPages || isLastPage}
              className={`${iconBtn} ${iconBtnTone}`}
              aria-label="Trang sau"
              title="Trang sau (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Zoom + fullscreen */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className={`${iconBtn} ${iconBtnTone}`}
              aria-label="Thu nhỏ"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className={`hidden sm:inline-flex items-center justify-center min-h-11 min-w-12 px-2 rounded-xl text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${iconBtnTone}`}
              aria-label={`Đặt lại thu phóng (hiện tại ${Math.round(scale * 100)}%)`}
              title="Đặt lại zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= 2.5}
              className={`${iconBtn} ${iconBtnTone}`}
              aria-label="Phóng to"
              title="Phóng to"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`${iconBtn} ${iconBtnTone}`}
              aria-label={isFullscreen ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
              aria-pressed={isFullscreen}
              title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Reading progress */}
        <div
          className={`h-1 w-full ${isFullscreen ? "bg-white/10" : "bg-surface-alt"}`}
          role="progressbar"
          aria-label="Tiến độ xem thử"
          aria-valuemin={0}
          aria-valuemax={totalPages || 0}
          aria-valuenow={totalPages ? pageNumber : 0}
        >
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-700 transition-[width] duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Screen-reader page announcement */}
      <p className="sr-only" aria-live="polite">
        {totalPages ? `Trang ${pageNumber} trên ${totalPages}` : ""}
      </p>

      {/* PDF View */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`relative flex justify-center bg-surface-alt p-2 sm:p-6 ${isFullscreen ? "flex-1 overflow-auto" : "overflow-x-auto overflow-y-hidden"}`}
        style={{ touchAction: scale > 1 ? "auto" : "pan-y pinch-zoom" }}
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-text-muted">
              <div className="w-9 h-9 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm">Đang tải bản xem thử...</p>
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center gap-3 min-h-[40vh] text-center px-4">
              <p className="text-sm font-medium text-text-primary">Không thể tải bản xem thử.</p>
              <p className="text-xs text-text-muted">Liên kết xem thử có thời hạn ngắn. Vui lòng tải lại trang.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 min-h-11 px-4 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <RefreshCcw className="w-4 h-4" />
                Tải lại
              </button>
            </div>
          }
          className="flex justify-center"
        >
          <div
            ref={pageWrapperRef}
            className="flex justify-center"
            style={{ minHeight: !isFullscreen && pageMinHeight ? pageMinHeight : undefined }}
          >
            <Page
              pageNumber={pageNumber}
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onRenderSuccess={handlePageRenderSuccess}
              loading={<div className="min-h-[60vh]" aria-hidden="true" />}
              className="bg-white shadow-lg ring-1 ring-black/5 max-w-full"
            />
          </div>
        </Document>
      </div>

      {/* Bottom navigation — large tap targets, hands off to the purchase CTA on the final page */}
      {!isFullscreen && totalPages ? (
        <div className="flex items-stretch gap-2 p-2 sm:p-3 border-t border-border">
          <button
            type="button"
            onClick={previousPage}
            disabled={pageNumber <= 1}
            className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-12 px-3 rounded-xl text-sm font-semibold border border-border text-text-primary bg-surface hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            Trang trước
          </button>
          {isLastPage && onLastPageNext ? (
            <button
              type="button"
              onClick={handleLastPageNext}
              className="flex-[1.4] inline-flex items-center justify-center gap-1.5 min-h-12 px-3 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 shadow-sm transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {lastPageNextLabel}
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={nextPage}
              disabled={isLastPage}
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-12 px-3 rounded-xl text-sm font-semibold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Trang sau
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
