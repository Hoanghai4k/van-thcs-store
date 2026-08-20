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
  // Convert storage paths to public URLs
  const imageUrls = (previewImages ?? [])
    .map((path) => getProductAssetUrl(path))
    .filter((url): url is string => url !== null);

  const hasImages = imageUrls.length > 0;

  if (hasImages) {
    return (
      <div className="space-y-3">
        {/* Main Image */}
        <div className="relative rounded-2xl overflow-hidden bg-surface-alt h-64 sm:h-80 md:h-96">
          <Image
            src={imageUrls[0]}
            alt={productName}
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
          <div className="flex gap-2 overflow-x-auto pb-1">
            {imageUrls.map((img, idx) => (
              <button
                key={idx}
                className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary-400 transition-colors focus:outline-none focus:border-primary-500"
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
    <div className="relative bg-gradient-to-br from-primary-50 via-blue-50 to-accent-50 rounded-2xl h-64 sm:h-80 md:h-96 flex flex-col items-center justify-center gap-3">
      <div className="w-24 h-24 bg-white/60 rounded-2xl flex items-center justify-center shadow-sm">
        <FileText className="w-14 h-14 text-primary-300" />
      </div>
      <span className="text-sm text-primary-400 font-medium">
        Tài liệu Word (.docx)
      </span>
      {discount && (
        <span className="absolute top-4 right-4 bg-error text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-md">
          -{discount}%
        </span>
      )}
    </div>
  );
}
