/**
 * Category validation schemas.
 */

import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Tên danh mục là bắt buộc").max(255, "Tên quá dài"),
  slug: z
    .string()
    .min(1, "Slug là bắt buộc")
    .max(255)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug chỉ chứa chữ thường, số và dấu gạch ngang",
    ),
  description: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().default(true),
});

export type CategoryFormData = z.infer<typeof categorySchema>;
