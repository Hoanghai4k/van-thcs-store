"use client";

import { useState } from "react";
import Image from "next/image";
import { FileText } from "lucide-react";
import { getProductAssetUrl } from "@/lib/storage/storage";

interface ProductGalleryProps {
  previewImages?: string[];
  productName: string;
  discount: number | null;
}

/**
 * Product preview gallery component.
 * Shows preview images if available, otherwise displays a styled fallback.
 * Converts storage paths to public URLs via getProductAssetUrl().
 */
export function ProductGallery({
  previewImages,
  productName,
  discount,
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  // Convert storage paths to public URLs
  const imageUrls = (previewImages ?? [])
    .map((path) => getProductAssetUrl(path))
    .filter((url): url is string => url !== null);

  const hasImages = imageUrls.length > 0;

  if (hasImages) {
    return (
      <div className="space-y-3">
        {/* Main Image */}
        <div className="relative rounded-2xl overflow-hidden bg-surface-alt h-64 sm:h-80 md:h-96 border border-border">
          <Image
            src={imageUrls[activeIndex] || imageUrls[0]}
            alt={`${productName} - ảnh ${activeIndex + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 60vw"
            unoptimized
          />
          {discount && (
            <span className="absolute top-4 right-4 bg-error text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-md">
              -{discount}%
            </span>
          )}
        </div>

        {/* Thumbnail Strip */}
        {imageUrls.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2 mt-4 hide-scrollbar">
            {imageUrls.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                  idx === activeIndex
                    ? "border-primary-600 shadow-md ring-1 ring-primary-600"
                    : "border-transparent hover:border-primary-300 dark:hover:border-primary-700 opacity-60 hover:opacity-100 bg-surface-alt"
                }`}
                aria-label={`Xem ảnh ${idx + 1}`}
              >
                <Image
                  src={img}
                  alt={`${productName} - ảnh ${idx + 1}`}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback: beautiful gradient placeholder
  return (
    <div className="relative bg-gradient-to-br from-primary-50 dark:from-primary-900/20 via-primary-50 dark:via-primary-900/20 to-accent-50 dark:to-accent-900/20 rounded-2xl h-64 sm:h-80 md:h-96 flex flex-col items-center justify-center gap-3">
      <div className="w-24 h-24 bg-white/60 dark:bg-black/30 rounded-2xl flex items-center justify-center shadow-sm">
        <FileText className="w-14 h-14 text-primary-300 dark:text-primary-700" />
      </div>
      <span className="text-sm text-primary-400 dark:text-primary-600 font-medium">
        Tài liệu số
      </span>
      {discount && (
        <span className="absolute top-4 right-4 bg-error text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-md">
          -{discount}%
        </span>
      )}
    </div>
  );
}
