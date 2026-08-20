/**
 * Common Zod validation schemas reused across features.
 */

import { z } from "zod";

export const emailSchema = z
  .string()
  .min(1, "Email là bắt buộc")
  .email("Email không hợp lệ")
  .transform((v) => v.trim().toLowerCase());

export const phoneSchema = z
  .string()
  .min(1, "Số điện thoại là bắt buộc")
  .transform((v) => v.trim().replace(/\s+/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^(0[3-9]\d{8}|(\+84)[3-9]\d{8})$/,
        "Số điện thoại chưa hợp lệ (VD: 0912345678)",
      ),
  );

export const nameSchema = z
  .string()
  .min(1, "Họ tên là bắt buộc")
  .min(2, "Họ tên phải có ít nhất 2 ký tự")
  .max(100, "Họ tên không được quá 100 ký tự")
  .transform((v) => v.trim());

export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug không hợp lệ");

export const uuidSchema = z.string().uuid("ID không hợp lệ");

export const positiveIntSchema = z.number().int().positive();
