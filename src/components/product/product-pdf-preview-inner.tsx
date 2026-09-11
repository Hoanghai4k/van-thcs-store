"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// Setup worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ProductPdfPreviewProps {
  url: string;
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

export function ProductPdfPreviewInner({ url }: ProductPdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);

  // Padding inside the PDF view area (p-4 = 16px each side on mobile, p-8 = 32px on sm+)
  // We use a conservative value that works for both
  const padding = containerWidth < 640 ? 32 : 64;
  const pageWidth = containerWidth > 0 ? Math.floor((containerWidth - padding) * scale) : undefined;

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const previousPage = () => setPageNumber(p => Math.max(1, p - 1));
  const nextPage = () => setPageNumber(p => Math.min(numPages || 1, p + 1));
  const zoomIn = () => setScale(s => Math.min(2.5, +(s + 0.2).toFixed(1)));
  const zoomOut = () => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)));

  const resetZoom = useCallback(() => setScale(1.0), []);

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
              {pageNumber} / {numPages || "-"}
            </span>
            <button 
              onClick={nextPage} 
              disabled={pageNumber >= (numPages || 1)}
              className={`p-1.5 rounded-lg transition-colors ${pageNumber >= (numPages || 1) ? "opacity-50 cursor-not-allowed" : isFullscreen ? "hover:bg-white/10" : "hover:bg-surface-hover"}`}
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
