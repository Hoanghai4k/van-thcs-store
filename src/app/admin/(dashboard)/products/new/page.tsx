import { listAllCategories } from "@/features/categories/queries";
import { ProductForm } from "@/components/admin/product-form";

export default async function AdminNewProductPage() {
  const categories = await listAllCategories();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Tạo sản phẩm mới
      </h1>
      <ProductForm categories={categories} mode="create" />
    </div>
  );
}
