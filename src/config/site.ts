/**
 * Centralized site configuration.
 * All branding, contact info, and site metadata are configured here.
 * Change this file to rebrand the site.
 */

export const siteConfig = {
  name: "Tài Liệu Hằng Cao",
  shortName: "Hằng Cao",
  tagline: "Tài liệu tham khảo Ngữ văn THCS",
  description:
    "Tài liệu tham khảo Ngữ văn THCS dành cho học sinh và giáo viên, hỗ trợ DOCX và ZIP, nhận tài liệu sau khi thanh toán.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://www.tailieuhangcao.vn",

  contact: {
    email: "",
    phone: "",
    address: "",
  },

  support: {
    zaloPhone: "0943413890",
    zaloUrl: "https://zalo.me/0943413890",
    facebookUrl: "https://www.facebook.com/share/1BnypsziyB/",
  },

  social: {
    facebook: "",
    zalo: "",
    youtube: "",
  },

  seo: {
    titleTemplate: "%s | Tài Liệu Hằng Cao",
    defaultTitle: "Tài Liệu Hằng Cao | Tài liệu tham khảo Ngữ văn THCS",
    ogImage: "/images/og-default.png",
  },

  store: {
    currency: "VND",
    currencySymbol: "₫",
    supportedFormats: ["DOCX", "ZIP"] as readonly string[],
    supportedFormatsLabel: "DOCX, ZIP",
    maxFileSizeBytes: 50 * 1024 * 1024,
    maxFileSizeLabel: "50 MB",
    maxDownloadsPerToken: 20,
    deliveryTokenExpiryDays: 30,
    signedUrlTtlSeconds: 60,
  },

  footer: {
    copyright: `© ${new Date().getFullYear()} Tài Liệu Hằng Cao. All rights reserved.`,
  },
} as const;

export type SiteConfig = typeof siteConfig;
