import { notFound } from "next/navigation";
import { getProductById, getAllProductsLight, getProductRelations } from "@/features/products/queries";
import { getProductFiles } from "@/features/products/file-actions";
import { listAllCategories } from "@/features/categories/queries";
import { ProductForm } from "@/components/admin/product-form";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params;

  const [product, productFiles, categories, allProducts, relations] = await Promise.all([
    getProductById(id),
    getProductFiles(id),
    listAllCategories(),
    getAllProductsLight(),
    getProductRelations(id),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">
        Chỉnh sửa sản phẩm
      </h1>
      <p className="text-sm text-slate-500 mb-6">{product.name}</p>
      <ProductForm
        product={product}
        productFiles={productFiles}
        categories={categories}
        allProducts={allProducts}
        initialPreviewOfIds={relations.fullVersions.map(p => p.id)}
        initialRelatedIds={relations.related.map(p => p.id)}
        mode="edit"
      />
    </div>
  );
}
