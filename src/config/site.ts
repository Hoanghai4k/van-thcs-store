/**
 * Centralized site configuration.
 * All branding, contact info, and site metadata are configured here.
 * Change this file to rebrand the site.
 */

export const siteConfig = {
  name: "Văn THCS Store",
  shortName: "Văn THCS",
  tagline: "Tài liệu Ngữ văn THCS chất lượng, học tập hiệu quả hơn.",
  description:
    "Cung cấp tài liệu Ngữ văn THCS chất lượng cao dạng Microsoft Word (.docx). Tải về ngay sau khi thanh toán.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",

  contact: {
    email: "contact@vanthcs.store",
    phone: "",
    address: "",
  },

  social: {
    facebook: "",
    zalo: "",
    youtube: "",
  },

  seo: {
    titleTemplate: "%s | Văn THCS Store",
    defaultTitle: "Văn THCS Store — Tài liệu Ngữ văn THCS",
    ogImage: "/images/og-default.png",
  },

  store: {
    currency: "VND",
    currencySymbol: "₫",
    fileFormat: ".docx",
    fileFormatLabel: "Microsoft Word (.docx)",
    maxDownloadsPerToken: 20,
    deliveryTokenExpiryDays: 30,
    signedUrlTtlSeconds: 60,
  },

  footer: {
    copyright: `© ${new Date().getFullYear()} Văn THCS Store. All rights reserved.`,
  },
} as const;

export type SiteConfig = typeof siteConfig;
