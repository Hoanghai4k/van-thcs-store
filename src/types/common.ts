/**
 * Common types shared across the application.
 */

/** API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Pagination parameters */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Paginated result */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Product with category info for display */
export interface ProductWithCategory {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  originalPrice: number | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  thumbnailPath: string | null;
  isActive: boolean;
}

/** Cart item stored on client */
export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  price: number;
  originalPrice: number | null;
  thumbnailPath: string | null;
  productType?: "PAID" | "FREE"; // Added for FREE product filtering
}

/** Checkout form data */
export interface CheckoutFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productIds: string[];
}

/** Order summary returned after checkout */
export interface OrderSummary {
  orderCode: string;
  orderId: string;
  totalAmount: number;
  status: string;
  checkoutUrl?: string;
  qrCode?: string;
  items: Array<{
    productName: string;
    unitPrice: number;
  }>;
}
