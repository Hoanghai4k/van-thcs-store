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
import { getProductBySlug, getProductRelations } from "@/features/products/queries";
import { getProductFiles } from "@/features/products/file-actions";
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
  
  const relations = await getProductRelations(product.id);
  
  // If product is FREE, we need to show its files directly
  const freeFiles = product.product_type === "FREE" 
    ? await getProductFiles(product.id) 
    : [];

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-8">
        {/* Mobile 1 / Desktop Left Top: Gallery */}
        <div className="lg:col-span-7 order-1">
          <ProductGallery
            previewImages={product.preview_images ?? undefined}
            productName={product.name}
            discount={discount}
          />
        </div>

        {/* Mobile 2 / Desktop Right: Product Info + CTA */}
        <div className="lg:col-span-5 order-2">
          <div className="sticky top-20 space-y-4">
            {/* Main Info Card */}
            <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
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
                {product.product_type === "FREE" ? (
                  <span className="text-3xl font-bold text-green-600">
                    MIỄN PHÍ
                  </span>
                ) : (
                  <>
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
                      <span className="text-sm font-semibold text-error bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                        -{discount}%
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Product Metadata */}
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                <div className="flex items-center gap-2.5 p-2.5 bg-surface-alt rounded-xl">
                  <FileText className="w-4.5 h-4.5 text-primary-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-text-muted">Định dạng</p>
                    <p className="text-sm font-medium text-text-primary">
                      {(product.file_format || "docx").toUpperCase()}
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

            {/* Relations Section (Full version for FREE, Free preview for PAID) */}
            {product.product_type === "FREE" && relations.fullVersions.length > 0 && (
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-2xl border border-primary-100 dark:border-primary-800 p-5">
                <h3 className="font-bold text-primary-800 dark:text-primary-300 mb-3 text-sm uppercase tracking-wide">Bản đầy đủ</h3>
                <div className="space-y-3">
                  {relations.fullVersions.map((fullProduct) => (
                    <Link key={fullProduct.id} href={`/products/${fullProduct.slug}`} className="block group/related bg-surface p-3 rounded-xl border border-primary-200 dark:border-primary-800 hover:border-primary-400 hover:shadow-md transition-all">
                      <p className="font-semibold text-text-primary group-hover/related:text-primary-700 dark:group-hover/related:text-primary-400 text-sm mb-1">{fullProduct.name}</p>
                      <p className="text-primary-600 dark:text-primary-400 font-bold text-sm">{formatCurrency(fullProduct.price)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {product.product_type === "PAID" && relations.freePreviews.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-800/50 p-5">
                <h3 className="font-bold text-green-800 dark:text-green-300 mb-3 text-sm uppercase tracking-wide">Xem bản mẫu miễn phí</h3>
                <div className="space-y-3">
                  {relations.freePreviews.map((freeProduct) => (
                    <Link key={freeProduct.id} href={`/products/${freeProduct.slug}`} className="block group/related bg-surface p-3 rounded-xl border border-green-200 dark:border-green-800/50 hover:border-green-400 hover:shadow-md transition-all">
                      <p className="font-semibold text-text-primary group-hover/related:text-green-700 dark:group-hover/related:text-green-400 text-sm mb-1">{freeProduct.name}</p>
                      <p className="text-green-600 dark:text-green-400 font-bold text-sm">MIỄN PHÍ</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Trust Section */}
            <div className="bg-surface rounded-2xl border border-border p-5">
              <div className="space-y-2.5 text-sm text-text-secondary">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Thanh toán an toàn qua payOS / VietQR</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Nhận tài liệu ngay sau khi thanh toán</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>
                    {product.file_format === "zip"
                      ? "Tệp tài liệu số (ZIP) bảo mật"
                      : product.file_format === "mixed"
                        ? "Tải qua hệ thống riêng tư (DOCX + ZIP)"
                        : "Tải qua hệ thống riêng tư (DOCX)"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile 3 / Desktop Left Bottom: Details (Description, Features, FAQ) */}
        <div className="lg:col-span-7 order-3 space-y-8 mt-2 lg:mt-0">
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
                    className="flex items-start gap-2.5 p-3 bg-green-50/60 dark:bg-green-900/20 rounded-xl"
                  >
                    <CheckCircle className="w-4.5 h-4.5 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium rounded-full"
                  >
                    <Users className="w-3.5 h-3.5" />
                    {audience}
                  </span>
                ))}
              </div>
            </section>
          )}

          <ProductFAQ />

          {/* Download block for FREE products */}
          {product.product_type === "FREE" && (
            <section id="free-download-section" className="scroll-mt-24 pt-6 border-t border-border">
              <h2 className="text-xl font-bold text-text-primary mb-5 flex items-center gap-2">
                <Download className="w-6 h-6 text-green-600" />
                Tải tài liệu miễn phí
              </h2>
              {freeFiles.length > 0 ? (
                <div className="space-y-3">
                  {freeFiles.map((file) => (
                    <div key={file.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-surface rounded-xl border border-border shadow-sm hover:border-green-300 transition-colors gap-4">
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <p className="font-medium text-text-primary text-sm truncate max-w-[200px] sm:max-w-xs">{file.file_name}</p>
                          <p className="text-xs text-text-muted mt-0.5">{(file.file_size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <a
                        href={`/api/free-downloads/${file.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Tải xuống
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-surface-alt rounded-2xl border border-border border-dashed">
                  <p className="text-text-muted">Chưa có tệp tài liệu nào được tải lên cho sản phẩm này.</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
