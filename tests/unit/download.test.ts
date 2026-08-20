/**
 * Legacy download validation tests — ported to new API.
 *
 * These tests validated the old validateTokenData function which
 * has been replaced by the delivery token validation flow.
 *
 * Token expiry and download limit tests are now in delivery-token.test.ts
 * Download security tests are now in delivery-download.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  isTokenExpired,
  isDownloadLimitReached,
} from "@/features/downloads/token";

describe("isTokenExpired (legacy compat)", () => {
  it("returns false for future date", () => {
    const future = new Date();
    future.setHours(future.getHours() + 24);
    expect(isTokenExpired(future.toISOString())).toBe(false);
  });

  it("returns true for past date", () => {
    const past = new Date();
    past.setHours(past.getHours() - 1);
    expect(isTokenExpired(past.toISOString())).toBe(true);
  });
});

describe("isDownloadLimitReached (legacy compat)", () => {
  it("returns false when under limit", () => {
    expect(isDownloadLimitReached(2, 5)).toBe(false);
  });

  it("returns true when at limit", () => {
    expect(isDownloadLimitReached(5, 5)).toBe(true);
  });

  it("returns true when over limit", () => {
    expect(isDownloadLimitReached(6, 5)).toBe(true);
  });
});
