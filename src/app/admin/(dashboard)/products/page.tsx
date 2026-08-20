import { getAdminProducts } from "@/features/products/queries";
import { listAllCategories } from "@/features/categories/queries";
import { AdminProductList } from "@/components/admin/product-list";

interface AdminProductsPageProps {
  searchParams: Promise<{ search?: string; category?: string; status?: string; page?: string }>;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const params = await searchParams;
  
  const isActive =
    params.status === "active"
      ? true
      : params.status === "inactive"
        ? false
        : undefined;

  const [{ products, total, page, pageSize, totalPages }, categories] =
    await Promise.all([
      getAdminProducts({
        search: params.search,
        categoryId: params.category,
        isActive,
        page: params.page ? parseInt(params.page, 10) : 1,
        pageSize: 20,
      }),
      listAllCategories(),
    ]);

  return (
    <div className="p-6">
      <AdminProductList
        products={products}
        categories={categories}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        currentSearch={params.search}
        currentCategory={params.category}
        currentStatus={params.status}
      />
    </div>
  );
}
