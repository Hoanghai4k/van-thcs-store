import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  FileText,
  Tag,
  ArrowLeft,
  Download,
  CheckCircle,
  BookOpen,
  Users,
  File,
} from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { getProductBySlug } from "@/features/products/queries";
import { formatCurrency } from "@/lib/utils";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductActions } from "@/components/product/product-actions";
import { ProductFAQ } from "@/components/product/product-faq";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Sản phẩm không tồn tại" };

  return {
    title: siteConfig.seo.titleTemplate.replace("%s", product.name),
    description: product.short_description || product.description || siteConfig.description,
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round(
          ((product.original_price - product.price) / product.original_price) *
            100,
        )
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link
          href="/products"
          className="hover:text-primary-600 transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Tài liệu
        </Link>
        {product.category && (
          <>
            <span>/</span>
            <Link
              href={`/categories/${product.category.slug}`}
              className="hover:text-primary-600 transition-colors"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-text-secondary truncate">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Left: Gallery + Description + Features + FAQ */}
        <div className="lg:col-span-3 space-y-8">
          {/* Gallery */}
          <ProductGallery
            previewImages={product.preview_images ?? undefined}
            productName={product.name}
            discount={discount}
          />

          {/* Description */}
          {product.description && (
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-3">
                Mô tả chi tiết
              </h2>
              <div className="prose prose-sm text-text-secondary max-w-none">
                <p className="leading-relaxed">{product.description}</p>
              </div>
            </section>
          )}

          {/* "Bạn nhận được gì?" */}
          {product.features && product.features.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-3">
                Bạn nhận được gì?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {product.features.map((feature, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 bg-green-50/60 rounded-xl"
                  >
                    <CheckCircle className="w-4.5 h-4.5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-text-primary">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* "Phù hợp với" */}
          {product.suitable_for && product.suitable_for.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-3">
                Phù hợp với
              </h2>
              <div className="flex flex-wrap gap-2">
                {product.suitable_for.map((audience, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 text-sm font-medium rounded-full"
                  >
                    <Users className="w-3.5 h-3.5" />
                    {audience}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* FAQ */}
          <ProductFAQ />
        </div>

        {/* Right: Product Info + CTA */}
        <div className="lg:col-span-2">
          <div className="sticky top-20 space-y-4">
            {/* Main Info Card */}
            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
              {product.category && (
                <div className="flex items-center gap-1.5 text-primary-600 text-sm font-medium mb-3">
                  <Tag className="w-4 h-4" />
                  {product.category.name}
                </div>
              )}

              <h1 className="text-xl md:text-2xl font-bold text-text-primary mb-3 leading-snug">
                {product.name}
              </h1>

              {product.short_description && (
                <p className="text-text-secondary text-sm mb-5 leading-relaxed">
                  {product.short_description}
                </p>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-5">
                <span className="text-3xl font-bold text-primary-600">
                  {formatCurrency(product.price)}
                </span>
                {product.original_price &&
                  product.original_price > product.price && (
                    <span className="text-lg text-text-muted line-through">
                      {formatCurrency(product.original_price)}
                    </span>
                  )}
                {discount && (
                  <span className="text-sm font-semibold text-error bg-red-50 px-2 py-0.5 rounded-full">
                    -{discount}%
                  </span>
                )}
              </div>

              {/* Product Metadata */}
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                <div className="flex items-center gap-2.5 p-2.5 bg-surface-alt rounded-xl">
                  <FileText className="w-4.5 h-4.5 text-primary-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-text-muted">Định dạng</p>
                    <p className="text-sm font-medium text-text-primary">
                      {product.file_format || siteConfig.store.fileFormat}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 bg-surface-alt rounded-xl">
                  <Download className="w-4.5 h-4.5 text-primary-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-text-muted">Nhận hàng</p>
                    <p className="text-sm font-medium text-text-primary">
                      Tải ngay
                    </p>
                  </div>
                </div>
                {product.file_count && (
                  <div className="flex items-center gap-2.5 p-2.5 bg-surface-alt rounded-xl">
                    <File className="w-4.5 h-4.5 text-primary-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-text-muted">Số file</p>
                      <p className="text-sm font-medium text-text-primary">
                        {product.file_count} file
                      </p>
                    </div>
                  </div>
                )}
                {product.page_count && (
                  <div className="flex items-center gap-2.5 p-2.5 bg-surface-alt rounded-xl">
                    <BookOpen className="w-4.5 h-4.5 text-primary-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-text-muted">Số trang</p>
                      <p className="text-sm font-medium text-text-primary">
                        {product.page_count} trang
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* CTA Buttons */}
              <ProductActions product={product} />
            </div>

            {/* Trust Section */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="space-y-2.5 text-sm text-text-secondary">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Tải ngay sau thanh toán</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>File Word chỉnh sửa được</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Có hỗ trợ nếu gặp lỗi tải file</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
