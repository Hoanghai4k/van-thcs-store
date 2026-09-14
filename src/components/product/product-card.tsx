"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Check, FileText, Tag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/components/cart/cart-provider";
import { getProductAssetUrl } from "@/lib/storage/storage";
import type { ProductWithCategory } from "@/features/products/types";

interface ProductCardProps {
  product: ProductWithCategory;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem, isInCart } = useCart();
  const inCart = isInCart(product.id);

  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round(
          ((product.original_price - product.price) / product.original_price) *
            100,
        )
      : null;

  function handleAddToCart() {
    if (inCart) return;
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      originalPrice: product.original_price,
      thumbnailPath: product.thumbnail_path,
    });
  }

  return (
    <div className="group bg-surface rounded-2xl border border-border hover:border-primary-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <Link href={`/products/${product.slug}`} className="relative block h-44 bg-gradient-to-br from-primary-50 via-primary-50 to-accent-50 overflow-hidden group/thumb cursor-pointer">
        <div className="absolute inset-0 flex items-center justify-center">
          {(() => {
            const thumbUrl = getProductAssetUrl(product.thumbnail_path);
            return thumbUrl ? (
              <Image
                src={thumbUrl}
                alt={product.name}
                fill
                className="object-contain p-2 group-hover/thumb:scale-105 transition-transform duration-500"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            ) : (
              <FileText className="w-16 h-16 text-primary-300 group-hover/thumb:text-primary-400 transition-colors group-hover/thumb:scale-110 duration-500" />
            );
          })()}
        </div>

        {discount && (
          <span className="absolute top-3 right-3 bg-error text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
            -{discount}%
          </span>
        )}
        {product.category && (
          <span className="absolute top-3 left-3 bg-surface/90 backdrop-blur-sm text-primary-600 text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 z-10">
            <Tag className="w-3 h-3" />
            {product.category.name}
          </span>
        )}
        
        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
          <span className="bg-white/90 text-primary-800 text-sm font-semibold px-4 py-2 rounded-full transform translate-y-4 group-hover/thumb:translate-y-0 transition-all duration-300">
            Xem chi tiết
          </span>
        </div>
      </Link>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <Link href={`/products/${product.slug}`} className="group/link">
          <h3 className="font-semibold text-text-primary text-sm leading-snug line-clamp-2 group-hover/link:text-primary-600 transition-colors mb-2">
            {product.name}
          </h3>
        </Link>

        {product.short_description && (
          <p className="text-xs text-text-muted line-clamp-2 mb-3 leading-relaxed">
            {product.short_description}
          </p>
        )}

        <div className="mt-auto">
          {/* Format */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px] font-medium bg-surface-alt text-text-secondary px-2 py-0.5 rounded border border-border">
              {product.file_format === "zip"
                ? "ZIP"
                : product.file_format === "mixed"
                  ? "DOCX + ZIP"
                  : "DOCX"}
            </span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2 mb-3">
              <>
                <span className="text-lg font-bold text-primary-600">
                  {formatCurrency(product.price)}
                </span>
                {product.original_price &&
                  product.original_price > product.price && (
                    <span className="text-sm text-text-muted line-through">
                      {formatCurrency(product.original_price)}
                    </span>
                  )}
              </>
          </div>

          {/* Action Button */}
            <button
              onClick={handleAddToCart}
              disabled={inCart}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                inCart
                  ? "bg-primary-50 text-primary-600 border border-primary-200 cursor-default"
                  : "bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-md active:scale-[0.98]"
              }`}
            >
              {inCart ? (
                <>
                  <Check className="w-4 h-4" />
                  Đã thêm vào giỏ
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  Thêm vào giỏ hàng
                </>
              )}
            </button>
        </div>
      </div>
    </div>
  );
}
