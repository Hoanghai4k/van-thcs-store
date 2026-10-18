"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/cart-provider";
import type { Product } from "@/features/products/types";

/** Minimal product shape needed to start the existing Buy Now flow. */
export type BuyNowProduct = Pick<
  Product,
  "id" | "name" | "slug" | "price" | "original_price" | "thumbnail_path" | "product_type"
>;

/**
 * The single, shared "Mua ngay" flow used across the storefront.
 *
 * Buy Now = add the product to the cart (if missing) → navigate to /checkout.
 * Checkout stays server-authoritative: /api/checkout re-validates products,
 * recalculates price/total from the database, attaches BONUS items and
 * creates payment_attempts before handing off to payOS. The cart price is
 * display-only and is never trusted.
 */
export function useBuyNow(product: BuyNowProduct) {
  const { addItem, isInCart } = useCart();
  const router = useRouter();
  const inCart = isInCart(product.id);

  const addToCart = useCallback(() => {
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      originalPrice: product.original_price,
      thumbnailPath: product.thumbnail_path,
      productType: product.product_type,
    });
  }, [
    addItem,
    product.id,
    product.name,
    product.slug,
    product.price,
    product.original_price,
    product.thumbnail_path,
    product.product_type,
  ]);

  const buyNow = useCallback(() => {
    if (!isInCart(product.id)) {
      addToCart();
    }
    router.push("/checkout");
  }, [isInCart, product.id, addToCart, router]);

  return { inCart, addToCart, buyNow };
}
