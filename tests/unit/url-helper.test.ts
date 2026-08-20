/**
 * URL helper tests.
 *
 * Tests the getSiteUrl() priority logic for production deployment.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

// We test the logic directly since getSiteUrl reads process.env
describe("getSiteUrl priority", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
    // Clear module cache so getSiteUrl re-reads env
    vi.resetModules();
  });

  async function loadGetSiteUrl() {
    const mod = await import("@/lib/url");
    return mod.getSiteUrl;
  }

  it("returns SITE_URL when set (highest priority)", async () => {
    process.env.SITE_URL = "https://tailieuhangcao.vn";
    process.env.NEXT_PUBLIC_SITE_URL = "https://other.com";
    process.env.VERCEL_URL = "project.vercel.app";
    const getSiteUrl = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe("https://tailieuhangcao.vn");
  });

  it("strips trailing slash from SITE_URL", async () => {
    process.env.SITE_URL = "https://tailieuhangcao.vn/";
    const getSiteUrl = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe("https://tailieuhangcao.vn");
  });

  it("falls back to NEXT_PUBLIC_SITE_URL when SITE_URL absent", async () => {
    delete process.env.SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://next-public.com";
    process.env.VERCEL_URL = "project.vercel.app";
    const getSiteUrl = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe("https://next-public.com");
  });

  it("falls back to VERCEL_URL with https prefix", async () => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_URL = "my-project-abc123.vercel.app";
    const getSiteUrl = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe("https://my-project-abc123.vercel.app");
  });

  it("falls back to localhost when no env vars set", async () => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    const getSiteUrl = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("never returns a URL with trailing slash", async () => {
    process.env.SITE_URL = "https://example.com///";
    const getSiteUrl = await loadGetSiteUrl();
    expect(getSiteUrl().endsWith("/")).toBe(false);
  });

  it("production SITE_URL is always HTTPS", async () => {
    process.env.SITE_URL = "https://tailieuhangcao.vn";
    const getSiteUrl = await loadGetSiteUrl();
    expect(getSiteUrl()).toMatch(/^https:\/\//);
  });

  it("VERCEL_URL fallback uses HTTPS", async () => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_URL = "test.vercel.app";
    const getSiteUrl = await loadGetSiteUrl();
    expect(getSiteUrl()).toMatch(/^https:\/\//);
  });
});
