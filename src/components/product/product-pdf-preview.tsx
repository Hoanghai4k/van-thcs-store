"use client";

import dynamic from "next/dynamic";
import type { ProductPdfPreviewProps } from "./product-pdf-preview-inner";

export type { ProductPdfPreviewProps, PdfPreviewVariant } from "./product-pdf-preview-inner";

const ProductPdfPreviewInner = dynamic(
  () => import("./product-pdf-preview-inner").then((mod) => mod.ProductPdfPreviewInner),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse min-h-[50vh] sm:min-h-[600px] bg-surface-alt rounded-2xl border border-border flex flex-col items-center justify-center text-text-muted gap-3">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm">Đang tải công cụ xem PDF...</p>
      </div>
    ),
  }
);

export function ProductPdfPreview(props: ProductPdfPreviewProps) {
  return <ProductPdfPreviewInner {...props} />;
}
