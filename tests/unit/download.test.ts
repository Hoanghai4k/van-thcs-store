import { describe, it, expect } from "vitest";
import {
  isTokenExpired,
  isDownloadLimitReached,
} from "@/features/downloads/token";
import { validateTokenData } from "@/features/downloads/service";

describe("isTokenExpired", () => {
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

describe("isDownloadLimitReached", () => {
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

describe("validateTokenData", () => {
  it("passes with valid data", () => {
    const future = new Date();
    future.setHours(future.getHours() + 24);
    const result = validateTokenData({
      expiresAt: future.toISOString(),
      downloadCount: 0,
      maxDownloads: 5,
      orderStatus: "PAID",
    });
    expect(result.valid).toBe(true);
  });

  it("fails with expired token", () => {
    const past = new Date();
    past.setHours(past.getHours() - 1);
    const result = validateTokenData({
      expiresAt: past.toISOString(),
      downloadCount: 0,
      maxDownloads: 5,
      orderStatus: "PAID",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("hết hạn");
  });

  it("fails with unpaid order", () => {
    const future = new Date();
    future.setHours(future.getHours() + 24);
    const result = validateTokenData({
      expiresAt: future.toISOString(),
      downloadCount: 0,
      maxDownloads: 5,
      orderStatus: "PENDING",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("chưa được thanh toán");
  });

  it("fails when download limit reached", () => {
    const future = new Date();
    future.setHours(future.getHours() + 24);
    const result = validateTokenData({
      expiresAt: future.toISOString(),
      downloadCount: 5,
      maxDownloads: 5,
      orderStatus: "PAID",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("lượt tải");
  });
});
