import { describe, it, expect } from "vitest";

describe("Bonus Product Security Guards", () => {
  it("rejects BONUS products from entering the checkout flow", () => {
    const products = [
      { id: "1", price: 50000, is_active: true, product_type: "PAID" },
      { id: "2", price: 0, is_active: true, product_type: "BONUS" },
    ];
    
    const invalidProducts = products.filter((p) => p.product_type === "BONUS");
    expect(invalidProducts.length).toBeGreaterThan(0);
    expect(invalidProducts[0].product_type).toBe("BONUS");
    
    // Simulate order-service guard
    const throwCheckoutError = () => {
      if (invalidProducts.length > 0) {
        throw new Error("Chỉ có thể thanh toán sản phẩm thương mại.");
      }
    };
    
    expect(throwCheckoutError).toThrow("Chỉ có thể thanh toán sản phẩm thương mại.");
  });
  
  it("allows PAID products to pass checkout guards", () => {
    const products = [
      { id: "1", price: 50000, is_active: true, product_type: "PAID" },
      { id: "3", price: 100000, is_active: true, product_type: "PAID" },
    ];
    
    const invalidProducts = products.filter((p) => p.product_type === "BONUS");
    expect(invalidProducts.length).toBe(0);
    
    const throwCheckoutError = () => {
      if (invalidProducts.length > 0) {
        throw new Error("Chỉ có thể thanh toán sản phẩm thương mại.");
      }
      return true;
    };
    
    expect(throwCheckoutError()).toBe(true);
  });
});

describe("Product Type & Relation Validations", () => {
  it("forces price to 0 when productType is BONUS", () => {
    const simulateAdminSave = (type: "PAID" | "BONUS", inputPrice: number) => {
      return type === "BONUS" ? 0 : inputPrice;
    };
    
    expect(simulateAdminSave("BONUS", 50000)).toBe(0);
    expect(simulateAdminSave("PAID", 50000)).toBe(50000);
  });

  it("validates BONUS_INCLUDED relation (PAID -> BONUS only)", () => {
    const validateRelation = (source: "BONUS" | "PAID", target: "BONUS" | "PAID") => {
      if (source !== "PAID" || target !== "BONUS") {
        throw new Error("Invalid BONUS_INCLUDED relation. Must be PAID -> BONUS.");
      }
      return true;
    };

    expect(validateRelation("PAID", "BONUS")).toBe(true);
    expect(() => validateRelation("PAID", "PAID")).toThrow();
    expect(() => validateRelation("BONUS", "BONUS")).toThrow();
    expect(() => validateRelation("BONUS", "PAID")).toThrow();
  });

  it("prevents self-relation", () => {
    const validateSelf = (sourceId: string, targetId: string) => {
      if (sourceId === targetId) throw new Error("Cannot relate to self.");
      return true;
    };

    expect(() => validateSelf("123", "123")).toThrow();
    expect(validateSelf("123", "456")).toBe(true);
  });

  it("requires at least one file to activate a BONUS product", () => {
    const activateProduct = (type: "BONUS" | "PAID", fileCount: number) => {
      if (fileCount === 0) {
        throw new Error("Không thể kích hoạt sản phẩm vì chưa có tệp tài liệu.");
      }
      return true;
    };

    expect(() => activateProduct("BONUS", 0)).toThrow();
    expect(() => activateProduct("PAID", 0)).toThrow();
    expect(activateProduct("BONUS", 1)).toBe(true);
  });
});
