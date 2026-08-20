import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getCategoryBySlug, getProducts, getCategories } from "@/features/products/queries";
import { ProductCard } from "@/components/product/product-card";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Danh mục không tồn tại" };
  return {
    title: siteConfig.seo.titleTemplate.replace("%s", category.name),
    description: category.description || `Tài liệu ${category.name} tại ${siteConfig.name}`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const [category, { products }, categories] = await Promise.all([
    getCategoryBySlug(slug),
    getProducts({ categorySlug: slug, pageSize: 24 }),
    getCategories(),
  ]);

  if (!category) notFound();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/products" className="hover:text-primary-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Tài liệu
        </Link>
        <span>/</span>
        <span className="text-text-secondary">{category.name}</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">{category.name}</h1>
        {category.description && <p className="text-text-secondary">{category.description}</p>}
        <p className="text-sm text-text-muted mt-1">{products.length} sản phẩm</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-56 flex-shrink-0">
          <div className="sticky top-20">
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">Danh mục</h2>
            <nav className="space-y-1">
              <Link href="/products" className="block px-3 py-2 text-sm text-text-secondary hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                Tất cả
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                    cat.slug === slug
                      ? "font-medium text-primary-600 bg-primary-50"
                      : "text-text-secondary hover:text-primary-600 hover:bg-primary-50"
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex-1">
          {products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-text-muted text-lg">Chưa có sản phẩm nào trong danh mục này.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
