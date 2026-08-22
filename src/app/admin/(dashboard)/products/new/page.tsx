import { listAllCategories } from "@/features/categories/queries";
import { getAllProductsLight } from "@/features/products/queries";
import { ProductForm } from "@/components/admin/product-form";

export default async function AdminNewProductPage() {
  const [categories, allProducts] = await Promise.all([
    listAllCategories(),
    getAllProductsLight(),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Tạo sản phẩm mới
      </h1>
      <ProductForm categories={categories} allProducts={allProducts} mode="create" />
    </div>
  );
}
