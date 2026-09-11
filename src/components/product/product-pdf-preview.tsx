"use client";

import dynamic from "next/dynamic";

const ProductPdfPreviewInner = dynamic(
  () => import("./product-pdf-preview-inner").then((mod) => mod.ProductPdfPreviewInner),
  { ssr: false, loading: () => <div className="animate-pulse h-[50vh] sm:h-[600px] bg-surface-alt rounded-xl border border-border flex items-center justify-center text-text-muted">Đang tải công cụ xem PDF...</div> }
);

interface ProductPdfPreviewProps {
  url: string;
}

export function ProductPdfPreview({ url }: ProductPdfPreviewProps) {
  return <ProductPdfPreviewInner url={url} />;
}
