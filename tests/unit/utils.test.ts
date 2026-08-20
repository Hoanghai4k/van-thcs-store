import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  generateSlug,
  generateOrderCode,
  normalizeEmail,
  formatFileSize,
  cn,
} from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats VND correctly", () => {
    const result = formatCurrency(99000);
    expect(result).toContain("99.000");
    expect(result).toContain("₫");
  });

  it("handles zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("handles large amounts", () => {
    const result = formatCurrency(1500000);
    expect(result).toContain("1.500.000");
  });
});

describe("generateSlug", () => {
  it("converts Vietnamese text to slug", () => {
    expect(generateSlug("Ngữ văn 9")).toBe("ngu-van-9");
  });

  it("handles special characters", () => {
    expect(generateSlug("Đề thi — Lớp 9")).toBe("de-thi-lop-9");
  });

  it("handles multiple spaces", () => {
    expect(generateSlug("Đọc   hiểu")).toBe("doc-hieu");
  });
});

describe("generateOrderCode", () => {
  it("generates code in expected format", () => {
    const code = generateOrderCode();
    expect(code).toMatch(/^VTS-\d{8}-[A-Z0-9]{5}$/);
  });

  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateOrderCode()));
    expect(codes.size).toBeGreaterThan(90);
  });
});

describe("normalizeEmail", () => {
  it("converts to lowercase", () => {
    expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats KB", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats MB", () => {
    expect(formatFileSize(1048576)).toBe("1.0 MB");
  });

  it("handles zero", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });
});

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters falsy values", () => {
    expect(cn("a", false, "b", null, undefined, "c")).toBe("a b c");
  });
});
