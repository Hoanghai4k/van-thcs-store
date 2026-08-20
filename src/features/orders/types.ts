/**
 * Order types.
 */

import type { OrderStatus } from "@/lib/constants";

export interface OrderWithItems {
  id: string;
  orderCode: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentMethod: string | null;
  paymentOrderCode: number | null;
  paymentTransactionId: string | null;
  status: OrderStatus;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDetail[];
}

export interface OrderItemDetail {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
}

export interface CreateOrderInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productIds: string[];
}
