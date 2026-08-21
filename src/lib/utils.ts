/**
 * Utility functions used across the application.
 */

import { randomBytes } from "crypto";

/**
 * Format a number as Vietnamese currency (VND).
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a date in Vietnamese locale.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/**
 * Format a date with time in Vietnamese locale.
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Generate a URL-friendly slug from a string.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Generate a unique order code.
 * Format: VTS-YYYYMMDD-XXXXX (cryptographically random alphanumeric)
 *
 * Uses crypto.randomBytes for better entropy than Math.random().
 * Collision probability is negligible (~60M possibilities per date).
 */
export function generateOrderCode(): string {
  const date = new Date();
  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I,O,0,1 for readability
  const bytes = randomBytes(5);
  let random = "";
  for (let i = 0; i < 5; i++) {
    random += chars[bytes[i] % chars.length];
  }
  return `VTS-${dateStr}-${random}`;
}

/**
 * Generate a unique numeric payment order code for providers like payOS.
 *
 * Strategy: Use current timestamp in milliseconds + 3-digit random suffix.
 * This produces a number within JavaScript's safe integer range (< 2^53).
 * Database UNIQUE constraint provides collision guarantee.
 *
 * Format: TTTTTTTTTTTTTrrr (13-digit timestamp + 3-digit random)
 * Max value: ~1724000000000999 (well within safe integer range)
 */
export function generatePaymentOrderCode(): number {
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 900) + 100; // 100-999
  return timestamp * 1000 + randomSuffix;
}

/**
 * Normalize email address for consistent storage.
 * Trims whitespace and converts to lowercase.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Conditionally join class names, filtering out falsy values.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Get the precise UTC Date object representing 00:00:00 local time in Vietnam
 * for the current day.
 */
export function getStartOfDayVN(): Date {
  const now = new Date();
  const vnFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = vnFormatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find(p => p.type === 'month')!.value, 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day')!.value, 10);
  
  // GMT+7 offset is -7 hours relative to UTC
  return new Date(Date.UTC(year, month, day, -7, 0, 0, 0));
}

/**
 * Get the precise UTC Date object representing 00:00:00 local time in Vietnam
 * for the next day.
 */
export function getEndOfDayVN(): Date {
  const now = new Date();
  const vnFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = vnFormatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find(p => p.type === 'month')!.value, 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day')!.value, 10);
  
  return new Date(Date.UTC(year, month, day + 1, -7, 0, 0, 0));
}

/**
 * Get the precise UTC Date object representing 00:00:00 local time in Vietnam
 * for the first day of the current month.
 */
export function getStartOfMonthVN(): Date {
  const now = new Date();
  const vnFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = vnFormatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find(p => p.type === 'month')!.value, 10) - 1;
  
  return new Date(Date.UTC(year, month, 1, -7, 0, 0, 0));
}

/**
 * Get the precise UTC Date object representing 00:00:00 local time in Vietnam
 * for the first day of the next month.
 */
export function getEndOfMonthVN(): Date {
  const now = new Date();
  const vnFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = vnFormatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find(p => p.type === 'month')!.value, 10) - 1;
  
  return new Date(Date.UTC(year, month + 1, 1, -7, 0, 0, 0));
}
