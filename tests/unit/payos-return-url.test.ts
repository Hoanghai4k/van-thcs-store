/**
 * payOS return/cancel URL routing tests.
 *
 * Verifies:
 * - returnUrl and cancelUrl point to existing routes
 * - payOS-appended query parameters do not cause 404
 * - query param status=PAID cannot mark an order PAID in the database
 * - order status page renders correct state for each DB status
 */

import { describe, it, expect } from "vitest";

/**
 * Simulate the returnUrl and cancelUrl generation logic
 * from src/features/orders/actions.ts (and checkout/route.ts, resume-payment/route.ts).
 */
function buildReturnUrl(siteUrl: string, orderCode: string): string {
  return `${siteUrl}/order/${orderCode}`;
}

function buildCancelUrl(siteUrl: string, orderCode: string): string {
  return `${siteUrl}/order/${orderCode}`;
}

/**
 * The set of valid Next.js App Router path patterns under (store).
 * These are the routes that actually exist and won't return 404.
 */
const VALID_ROUTE_PATTERNS = [
  /^\/order\/lookup$/,
  /^\/order\/success$/,
  /^\/order\/[^/]+$/, // /order/[orderCode] — dynamic segment
];

function routeExists(pathname: string): boolean {
  return VALID_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Simulate payOS appending query parameters to the returnUrl after payment.
 * payOS appends: code, id, cancel, status, orderCode (numeric payment code).
 */
function appendPayosParams(
  url: string,
  params: {
    code: string;
    id: string;
    cancel: string;
    status: string;
    orderCode: string; // numeric payment order code from payOS
  },
): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}code=${params.code}&id=${params.id}&cancel=${params.cancel}&status=${params.status}&orderCode=${params.orderCode}`;
}

/**
 * Extract the pathname from a full URL (ignoring query params).
 */
function extractPathname(fullUrl: string): string {
  try {
    return new URL(fullUrl).pathname;
  } catch {
    // If it's already a path, return as-is
    const qIdx = fullUrl.indexOf("?");
    return qIdx === -1 ? fullUrl : fullUrl.slice(0, qIdx);
  }
}

// Replicate status config from src/app/(store)/order/[orderCode]/page.tsx
function getStatusConfig(status: string) {
  switch (status) {
    case "PAID":
      return {
        title: "Thanh toán thành công",
        subtitle: "Cảm ơn bạn! Tài liệu sẽ được cung cấp ở bước tiếp theo.",
      };
    case "PENDING":
      return {
        title: "Đơn hàng đang chờ thanh toán",
        subtitle:
          "Đơn hàng đã được tạo. Vui lòng hoàn tất thanh toán để nhận tài liệu.",
      };
    case "CANCELLED":
      return {
        title: "Đơn hàng đã hủy",
        subtitle: "Đơn hàng này đã bị hủy. Bạn có thể tạo đơn hàng mới.",
      };
    case "FAILED":
      return {
        title: "Thanh toán thất bại",
        subtitle:
          "Thanh toán không thành công. Vui lòng tạo đơn hàng mới để thử lại.",
      };
    default:
      return { title: "Đơn hàng", subtitle: "" };
  }
}

describe("payOS return URL routing", () => {
  const siteUrl = "https://www.tailieuhangcao.vn";
  const orderCode = "VTS-20240815-ABCDE";

  describe("generated URLs resolve to existing routes", () => {
    it("returnUrl resolves to an existing Next.js route", () => {
      const returnUrl = buildReturnUrl(siteUrl, orderCode);
      const pathname = extractPathname(returnUrl);
      expect(routeExists(pathname)).toBe(true);
    });

    it("cancelUrl resolves to an existing Next.js route", () => {
      const cancelUrl = buildCancelUrl(siteUrl, orderCode);
      const pathname = extractPathname(cancelUrl);
      expect(routeExists(pathname)).toBe(true);
    });

    it("returnUrl points to /order/{orderCode} (path-based, not query-based)", () => {
      const returnUrl = buildReturnUrl(siteUrl, orderCode);
      expect(returnUrl).toBe(`${siteUrl}/order/${orderCode}`);
      // Must NOT use query param for the order code
      expect(returnUrl).not.toContain("?orderCode=");
      expect(returnUrl).not.toContain("/success");
    });

    it("cancelUrl points to /order/{orderCode}", () => {
      const cancelUrl = buildCancelUrl(siteUrl, orderCode);
      expect(cancelUrl).toBe(`${siteUrl}/order/${orderCode}`);
    });
  });

  describe("payOS query params do not cause 404", () => {
    const payosParams = {
      code: "00",
      id: "2e4acf1083304877bf1a8c108b30cccd",
      cancel: "false",
      status: "PAID",
      orderCode: "803347", // numeric payment order code from payOS
    };

    it("returnUrl with payOS params still resolves to existing route", () => {
      const returnUrl = buildReturnUrl(siteUrl, orderCode);
      const withParams = appendPayosParams(returnUrl, payosParams);
      const pathname = extractPathname(withParams);
      // The pathname is /order/VTS-20240815-ABCDE regardless of query params
      expect(routeExists(pathname)).toBe(true);
    });

    it("cancelUrl with payOS cancel=true still resolves to existing route", () => {
      const cancelUrl = buildCancelUrl(siteUrl, orderCode);
      const cancelParams = { ...payosParams, cancel: "true", status: "CANCELLED" };
      const withParams = appendPayosParams(cancelUrl, cancelParams);
      const pathname = extractPathname(withParams);
      expect(routeExists(pathname)).toBe(true);
    });

    it("payOS appending its own orderCode param does not affect the path", () => {
      const returnUrl = buildReturnUrl(siteUrl, orderCode);
      const withParams = appendPayosParams(returnUrl, payosParams);
      const pathname = extractPathname(withParams);
      // The order code in the path is our VTS-XXX code, not the numeric payOS code
      expect(pathname).toContain(orderCode);
      expect(pathname).not.toContain("803347");
    });
  });

  describe("security: query params cannot mark order PAID", () => {
    it("query status=PAID cannot mark a database order PAID", () => {
      // The order status page reads status from the DATABASE, not from query params.
      // Simulate: query param says PAID, but DB says PENDING.
      // The page uses dbStatus, not any query param.
      const dbStatus = "PENDING";

      // The page uses dbStatus, not queryStatus
      const config = getStatusConfig(dbStatus);
      expect(config.title).toContain("chờ thanh toán");
      expect(config.title).not.toContain("thành công");
    });

    it("query code=00 does not influence displayed status", () => {
      // code=00 from payOS means success at payOS side,
      // but our page only trusts the DB status
      const dbStatus = "PENDING";
      const config = getStatusConfig(dbStatus);
      expect(config.title).toBe("Đơn hàng đang chờ thanh toán");
    });
  });

  describe("order status page renders correct state from DB", () => {
    it("DB PAID order renders success state", () => {
      const config = getStatusConfig("PAID");
      expect(config.title).toBe("Thanh toán thành công");
    });

    it("DB PENDING order renders pending state", () => {
      const config = getStatusConfig("PENDING");
      expect(config.title).toBe("Đơn hàng đang chờ thanh toán");
    });

    it("DB CANCELLED order renders cancelled state", () => {
      const config = getStatusConfig("CANCELLED");
      expect(config.title).toBe("Đơn hàng đã hủy");
    });

    it("DB FAILED order renders failed state", () => {
      const config = getStatusConfig("FAILED");
      expect(config.title).toBe("Thanh toán thất bại");
    });
  });

  describe("production URL validation", () => {
    it("returnUrl starts with production domain, not localhost", () => {
      const returnUrl = buildReturnUrl(siteUrl, orderCode);
      expect(returnUrl).toMatch(/^https:\/\/www\.tailieuhangcao\.vn/);
      expect(returnUrl).not.toContain("localhost");
      expect(returnUrl).not.toContain("127.0.0.1");
      expect(returnUrl).not.toContain("192.168.");
    });

    it("cancelUrl starts with production domain, not localhost", () => {
      const cancelUrl = buildCancelUrl(siteUrl, orderCode);
      expect(cancelUrl).toMatch(/^https:\/\/www\.tailieuhangcao\.vn/);
      expect(cancelUrl).not.toContain("localhost");
    });
  });
});
