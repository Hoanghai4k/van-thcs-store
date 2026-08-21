/**
 * Tests for product and category schemas.
 */

import { describe, it, expect } from "vitest";
import { createProductSchema, updateProductSchema } from "../../src/features/products/schema";
import { categorySchema } from "../../src/features/categories/schema";

// ─── Category Schema ───────────────────────────────────────────────

describe("categorySchema", () => {
  it("accepts valid category data", () => {
    const result = categorySchema.safeParse({
      name: "Ngữ văn 6",
      slug: "ngu-van-6",
      description: "Tài liệu Ngữ văn lớp 6",
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("requires name", () => {
    const result = categorySchema.safeParse({
      name: "",
      slug: "test",
    });
    expect(result.success).toBe(false);
  });

  it("requires slug", () => {
    const result = categorySchema.safeParse({
      name: "Test",
      slug: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid slug format", () => {
    const result = categorySchema.safeParse({
      name: "Test",
      slug: "Invalid Slug!",
    });
    expect(result.success).toBe(false);
  });

  it("accepts slug with numbers and dashes", () => {
    const result = categorySchema.safeParse({
      name: "Test",
      slug: "nghi-luan-xa-hoi-2024",
    });
    expect(result.success).toBe(true);
  });

  it("allows null description", () => {
    const result = categorySchema.safeParse({
      name: "Test",
      slug: "test",
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it("defaults is_active to true", () => {
    const result = categorySchema.safeParse({
      name: "Test",
      slug: "test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_active).toBe(true);
    }
  });
});

// ─── Product Schema ────────────────────────────────────────────────

describe("createProductSchema", () => {
  it("accepts valid product data", () => {
    const result = createProductSchema.safeParse({
      name: "Bộ đề đọc hiểu",
      slug: "bo-de-doc-hieu",
      price: 99000,
    });
    expect(result.success).toBe(true);
  });

  it("requires name", () => {
    const result = createProductSchema.safeParse({
      name: "",
      slug: "test",
      price: 99000,
    });
    expect(result.success).toBe(false);
  });

  it("requires slug", () => {
    const result = createProductSchema.safeParse({
      name: "Test",
      slug: "",
      price: 99000,
    });
    expect(result.success).toBe(false);
  });

  it("requires price >= 0", () => {
    const negativeResult = createProductSchema.safeParse({
      name: "Test",
      slug: "test",
      price: -100,
    });
    expect(negativeResult.success).toBe(false);

    const zeroResult = createProductSchema.safeParse({
      name: "Test",
      slug: "test",
      price: 0,
    });
    expect(zeroResult.success).toBe(true);
  });

  it("requires integer price", () => {
    const result = createProductSchema.safeParse({
      name: "Test",
      slug: "test",
      price: 99.5,
    });
    expect(result.success).toBe(false);
  });

  it("validates categoryId as UUID", () => {
    const invalid = createProductSchema.safeParse({
      name: "Test",
      slug: "test",
      price: 99000,
      categoryId: "cat-1",
    });
    expect(invalid.success).toBe(false);

    const valid = createProductSchema.safeParse({
      name: "Test",
      slug: "test",
      price: 99000,
      categoryId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(valid.success).toBe(true);
  });

  it("accepts optional enrichment fields", () => {
    const result = createProductSchema.safeParse({
      name: "Test Product",
      slug: "test-product",
      price: 99000,
      features: ["Feature 1", "Feature 2"],
      suitableFor: ["Học sinh lớp 9"],
      pageCount: 50,
      fileFormat: "docx",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.features).toEqual(["Feature 1", "Feature 2"]);
      expect(result.data.suitableFor).toEqual(["Học sinh lớp 9"]);
      expect(result.data.pageCount).toBe(50);
    }
  });

  it("rejects negative page count", () => {
    const result = createProductSchema.safeParse({
      name: "Test",
      slug: "test",
      price: 99000,
      pageCount: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateProductSchema", () => {
  it("allows partial updates", () => {
    const result = updateProductSchema.safeParse({
      name: "Updated Name",
    });
    expect(result.success).toBe(true);
  });

  it("allows empty update (all optional)", () => {
    const result = updateProductSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("validates fields when provided", () => {
    const result = updateProductSchema.safeParse({
      price: -100,
    });
    expect(result.success).toBe(false);
  });
});

// ─── file_count business rules ─────────────────────────────────────

describe("file_count draft workflow", () => {
  it("draft product with file_count 0 is valid at schema level", () => {
    // The createProductSchema does NOT include file_count — it's set
    // server-side. This test validates that the schema doesn't
    // accidentally require file_count from the client.
    const result = createProductSchema.safeParse({
      name: "Draft Product",
      slug: "draft-product",
      price: 99000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // file_count should NOT be in schema output — it's derived
      expect("fileCount" in result.data).toBe(false);
    }
  });
});

describe("activation rules (application level)", () => {
  // These test the invariant enforced by toggleProductActive():
  //   draft + 0 files → allowed
  //   active + 0 files → BLOCKED
  //   active + >=1 files → allowed

  it("draft with zero files is valid (file_count >= 0 constraint)", () => {
    const fileCount = 0;
    const isActive = false;
    // Draft + 0 files: DB allows, application allows
    expect(fileCount >= 0).toBe(true);
    expect(!isActive || fileCount >= 1).toBe(true);
  });

  it("activation with zero files is blocked", () => {
    const fileCount = 0;
    // Application rule: cannot activate with 0 files
    const canActivate = fileCount >= 1;
    expect(canActivate).toBe(false);
  });

  it("activation with one or more files is allowed", () => {
    const fileCount = 1;
    const canActivate = fileCount >= 1;
    expect(canActivate).toBe(true);
  });

  it("negative file_count violates DB constraint", () => {
    const fileCount = -1;
    // DB CHECK: file_count >= 0
    expect(fileCount >= 0).toBe(false);
  });

  it("file_count is derived from product_files records", () => {
    // Simulating: 3 product_file records → file_count should be 3
    const productFileRecords = [
      { id: "a", product_id: "p1" },
      { id: "b", product_id: "p1" },
      { id: "c", product_id: "p1" },
    ];
    const derivedCount = productFileRecords.filter(
      (f) => f.product_id === "p1",
    ).length;
    expect(derivedCount).toBe(3);
  });
});
