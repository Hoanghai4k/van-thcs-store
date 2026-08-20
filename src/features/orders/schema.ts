/**
 * Order validation schemas.
 */

import { z } from "zod";
import { emailSchema, nameSchema, phoneSchema } from "@/lib/validation/common";

/** Full checkout schema used by the server action (includes productIds) */
export const checkoutSchema = z.object({
  customerName: nameSchema,
  customerEmail: emailSchema,
  customerPhone: phoneSchema,
  productIds: z
    .array(z.string().uuid("Product ID không hợp lệ"))
    .min(1, "Giỏ hàng không được rỗng"),
});

/** Client-side form validation schema (customer fields only) */
export const checkoutFormSchema = z.object({
  customerName: nameSchema,
  customerEmail: emailSchema,
  customerPhone: phoneSchema,
});

export const orderLookupSchema = z.object({
  orderCode: z
    .string()
    .min(1, "Mã đơn hàng là bắt buộc")
    .regex(/^VTS-\d{8}-[A-Z0-9]{5}$/, "Mã đơn hàng không đúng định dạng"),
  email: emailSchema,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutFormFields = z.infer<typeof checkoutFormSchema>;
export type OrderLookupInput = z.infer<typeof orderLookupSchema>;

