"use client";

import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import type { ProductWithCategory } from "@/features/products/types";

interface AddToCartButtonProps {
  product: ProductWithCategory;
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const { addItem, isInCart } = useCart();
  const inCart = isInCart(product.id);

  function handleClick() {
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
    <button
      onClick={handleClick}
      disabled={inCart}
      className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-base font-semibold transition-all duration-200 ${
        inCart
          ? "bg-green-50 text-green-600 border-2 border-green-200 cursor-default"
          : "bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg active:scale-[0.98]"
      }`}
    >
      {inCart ? (
        <>
          <Check className="w-5 h-5" />
          Đã thêm vào giỏ hàng
        </>
      ) : (
        <>
          <ShoppingCart className="w-5 h-5" />
          Thêm vào giỏ hàng
        </>
      )}
    </button>
  );
}
