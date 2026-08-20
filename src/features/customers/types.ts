/**
 * Customer types.
 */

export interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orderCount?: number;
  totalSpent?: number;
}
