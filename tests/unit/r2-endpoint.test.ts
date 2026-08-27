import { describe, it, expect } from "vitest";
import { buildR2Endpoint } from "@/lib/storage/r2-client";

describe("buildR2Endpoint", () => {
  it("raw valid account ID -> correct HTTPS endpoint", () => {
    const endpoint = buildR2Endpoint("1234567890abcdef");
    expect(endpoint).toBe("https://1234567890abcdef.r2.cloudflarestorage.com");
  });

  it("account ID with leading/trailing spaces -> safely trimmed", () => {
    const endpoint = buildR2Endpoint("  1234567890abcdef  ");
    expect(endpoint).toBe("https://1234567890abcdef.r2.cloudflarestorage.com");
  });

  it("account ID containing https:// -> configuration rejection", () => {
    expect(() => buildR2Endpoint("https://1234567890abcdef")).toThrowError(/raw Cloudflare Account ID/);
  });

  it("account ID containing hostname -> configuration rejection", () => {
    expect(() => buildR2Endpoint("1234567890abcdef.r2.cloudflarestorage.com")).toThrowError(/raw Cloudflare Account ID/);
  });

  it("empty account ID -> configuration rejection", () => {
    expect(() => buildR2Endpoint("")).toThrowError(/R2_ACCOUNT_ID is empty/);
    expect(() => buildR2Endpoint("   ")).toThrowError(/R2_ACCOUNT_ID is empty/);
  });

  it("account ID containing slashes -> configuration rejection", () => {
    expect(() => buildR2Endpoint("12345/67890")).toThrowError(/raw Cloudflare Account ID/);
  });

  describe("with override endpoint (R2_ENDPOINT)", () => {
    it("valid override endpoint is accepted", () => {
      const endpoint = buildR2Endpoint("ignored", "https://custom.r2.cloudflarestorage.com");
      expect(endpoint).toBe("https://custom.r2.cloudflarestorage.com");
    });

    it("override must start with https://", () => {
      expect(() => buildR2Endpoint("ignored", "http://custom.r2.cloudflarestorage.com")).toThrowError(/must start with https:\/\//);
    });

    it("override must be r2.cloudflarestorage.com domain", () => {
      expect(() => buildR2Endpoint("ignored", "https://api.cloudflare.com")).toThrowError(/must be an r2.cloudflarestorage.com domain/);
    });

    it("override must not specify explicit non-HTTPS port", () => {
      expect(() => buildR2Endpoint("ignored", "https://custom.r2.cloudflarestorage.com:8443")).toThrowError(/must not specify an explicit non-HTTPS port/);
    });
    
    it("override with explicit 443 port is accepted (stripped by URL parser or allowed)", () => {
      const endpoint = buildR2Endpoint("ignored", "https://custom.r2.cloudflarestorage.com:443");
      expect(endpoint).toBe("https://custom.r2.cloudflarestorage.com");
    });
  });
});
