/**
 * Product validation schemas.
 */

import { z } from "zod";

export const productTypeSchema = z.enum(["PAID", "BONUS"]);
export type ProductType = z.infer<typeof productTypeSchema>;

export const baseProductSchema = z.object({
  name: z.string().min(1, "Tên sản phẩm là bắt buộc").max(255, "Tên quá dài"),
  slug: z
    .string()
    .min(1, "Slug là bắt buộc")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ chứa chữ thường, số và dấu gạch ngang"),
  shortDescription: z.string().max(500, "Mô tả ngắn tối đa 500 ký tự").nullable().optional(),
  description: z.string().nullable().optional(),
  price: z.number().int("Giá phải là số nguyên").min(0, "Giá không được âm"),
  originalPrice: z.number().int().min(0).nullable().optional(),
  categoryId: z.string().uuid("Danh mục không hợp lệ").nullable().optional(),
  thumbnailPath: z.string().nullable().optional(),
  previewImages: z.array(z.string()).nullable().optional(),
  pageCount: z.number().int().positive("Số trang phải lớn hơn 0").nullable().optional(),
  fileFormat: z.string().default("docx"),
  features: z.array(z.string()).nullable().optional(),
  suitableFor: z.array(z.string()).nullable().optional(),
  productType: productTypeSchema.default("PAID"),
  relatedIds: z.array(z.string()).optional(),
  bonusIncludedIds: z.array(z.string()).optional(),
});

export const createProductSchema = baseProductSchema.refine(
  (data) => {
    if (data.productType === "BONUS" && data.price !== 0) return false;
    if (data.productType === "PAID" && data.price <= 0) return false;
    return true;
  },
  {
    message: "Sản phẩm trả phí phải có giá lớn hơn 0, quà tặng phải có giá bằng 0",
    path: ["price"],
  }
);

export const updateProductSchema = baseProductSchema.partial().refine(
  (data) => {
    if (data.productType === "BONUS" && data.price !== undefined && data.price !== 0) return false;
    if (data.productType === "PAID" && data.price !== undefined && data.price <= 0) return false;
    return true;
  },
  {
    message: "Sản phẩm trả phí phải có giá lớn hơn 0, quà tặng phải có giá bằng 0",
    path: ["price"],
  }
);

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
