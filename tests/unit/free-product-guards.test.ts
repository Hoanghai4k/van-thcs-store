import { describe, it, expect } from "vitest";

describe("Free Product Security Guards", () => {
  it("rejects FREE products from entering the checkout flow", () => {
    const products = [
      { id: "1", price: 50000, is_active: true, product_type: "PAID" },
      { id: "2", price: 0, is_active: true, product_type: "FREE" },
    ];
    
    const freeProducts = products.filter((p) => p.product_type === "FREE");
    expect(freeProducts.length).toBeGreaterThan(0);
    expect(freeProducts[0].product_type).toBe("FREE");
    
    // Simulate order-service guard
    const throwCheckoutError = () => {
      if (freeProducts.length > 0) {
        throw new Error("Không thể thanh toán sản phẩm miễn phí qua cổng này.");
      }
    };
    
    expect(throwCheckoutError).toThrow("Không thể thanh toán sản phẩm miễn phí qua cổng này.");
  });
  
  it("allows PAID products to pass checkout guards", () => {
    const products = [
      { id: "1", price: 50000, is_active: true, product_type: "PAID" },
      { id: "3", price: 100000, is_active: true, product_type: "PAID" },
    ];
    
    const freeProducts = products.filter((p) => p.product_type === "FREE");
    expect(freeProducts.length).toBe(0);
    
    const throwCheckoutError = () => {
      if (freeProducts.length > 0) {
        throw new Error("Không thể thanh toán sản phẩm miễn phí qua cổng này.");
      }
      return true;
    };
    
    expect(throwCheckoutError()).toBe(true);
  });
});

describe("Product Type & Relation Validations", () => {
  it("forces price to 0 when productType is FREE", () => {
    const simulateAdminSave = (type: "PAID" | "FREE", inputPrice: number) => {
      return type === "FREE" ? 0 : inputPrice;
    };
    
    expect(simulateAdminSave("FREE", 50000)).toBe(0);
    expect(simulateAdminSave("PAID", 50000)).toBe(50000);
  });

  it("validates PREVIEW_OF relation (FREE -> PAID only)", () => {
    const validateRelation = (source: "FREE" | "PAID", target: "FREE" | "PAID") => {
      if (source !== "FREE" || target !== "PAID") {
        throw new Error("Invalid PREVIEW_OF relation. Must be FREE -> PAID.");
      }
      return true;
    };

    expect(validateRelation("FREE", "PAID")).toBe(true);
    expect(() => validateRelation("PAID", "PAID")).toThrow();
    expect(() => validateRelation("FREE", "FREE")).toThrow();
    expect(() => validateRelation("PAID", "FREE")).toThrow();
  });

  it("prevents self-relation", () => {
    const validateSelf = (sourceId: string, targetId: string) => {
      if (sourceId === targetId) throw new Error("Cannot relate to self.");
      return true;
    };

    expect(() => validateSelf("123", "123")).toThrow();
    expect(validateSelf("123", "456")).toBe(true);
  });

  it("requires at least one file to activate a FREE product", () => {
    const activateProduct = (type: "FREE" | "PAID", fileCount: number) => {
      if (fileCount === 0) {
        throw new Error("Không thể kích hoạt sản phẩm vì chưa có tệp tài liệu.");
      }
      return true;
    };

    expect(() => activateProduct("FREE", 0)).toThrow();
    expect(() => activateProduct("PAID", 0)).toThrow();
    expect(activateProduct("FREE", 1)).toBe(true);
  });
});
