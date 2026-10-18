import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { getSiteUrl } from "@/lib/url";
import { getProductAssetUrl } from "@/lib/storage/storage";
import {
  getPreviewLandingData,
  getPreviewLandingProduct,
} from "@/features/products/preview-landing";
import { PreviewLandingView } from "@/components/preview/preview-landing-view";

interface PreviewLandingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PreviewLandingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPreviewLandingProduct(slug);

  if (!product) {
    return {
      title: `Tài liệu không tồn tại | ${siteConfig.name}`,
    };
  }

  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/products/${product.slug}`;
  const ogImageUrl = product.thumbnail_path
    ? getProductAssetUrl(product.thumbnail_path)
    : `${siteUrl}${siteConfig.seo.ogImage}`;

  const title = `Xem thử ${product.name} | ${siteConfig.name}`;
  const description =
    product.short_description ||
    `Xem trước tối đa 25 trang trước khi mua bản đầy đủ ${product.name}. Nhận tài liệu ngay sau khi thanh toán.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/xem-thu/${product.slug}`,
      siteName: siteConfig.name,
      locale: "vi_VN",
      type: "website",
      images: ogImageUrl ? [{ url: ogImageUrl, alt: product.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
  };
}

export default async function PreviewLandingPage({
  params,
}: PreviewLandingPageProps) {
  const { slug } = await params;
  const data = await getPreviewLandingData(slug);

  if (!data) {
    notFound();
  }

  return (
    <PreviewLandingView
      product={data.product}
      preview={data.preview}
      hasBonus={data.hasBonus}
    />
  );
}
