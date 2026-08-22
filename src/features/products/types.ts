/**
 * Product types used in the features/products domain.
 */

import type { DbProduct, DbCategory } from "@/types/database";
import type { ProductType } from "./schema";

export type Product = Omit<DbProduct, "product_type"> & {
  product_type: ProductType;
};
export type Category = DbCategory;
export type { ProductType };

export interface ProductWithCategory extends Product {
  category: Category | null;
}

export interface ProductListParams {
  categorySlug?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  isActive?: boolean;
}

export interface ProductListResult {
  products: ProductWithCategory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
