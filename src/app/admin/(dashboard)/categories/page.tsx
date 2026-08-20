import { listAllCategories } from "@/features/categories/queries";
import { AdminCategoryList } from "@/components/admin/category-list";

export default async function AdminCategoriesPage() {
  const categories = await listAllCategories();

  return (
    <div className="p-6">
      <AdminCategoryList initialCategories={categories} />
    </div>
  );
}
