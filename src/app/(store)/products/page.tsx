import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { getProducts, getCategories } from "@/features/products/queries";
import { ProductCard } from "@/components/product/product-card";
import Link from "next/link";

export const metadata: Metadata = {
  title: `Tất cả sản phẩm ${siteConfig.seo.titleTemplate.replace("%s", "")}`.trim(),
  description: `Khám phá kho tài liệu Ngữ văn THCS chất lượng cao tại ${siteConfig.name}`,
};

export default async function ProductsPage() {
  const [{ products }, categories] = await Promise.all([
    getProducts({ pageSize: 24 }),
    getCategories(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
          Tất cả tài liệu
        </h1>
        <p className="text-text-secondary">
          {products.length} sản phẩm có sẵn
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar: Categories */}
        <aside className="lg:w-56 flex-shrink-0">
          <div className="sticky top-20">
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
              Danh mục
            </h2>
            <nav className="space-y-1">
              <Link
                href="/products"
                className="block px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg"
              >
                Tất cả
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className="block px-3 py-2 text-sm text-text-secondary hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          {products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-text-muted text-lg">
                Chưa có sản phẩm nào.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
