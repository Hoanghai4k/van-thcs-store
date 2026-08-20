import Link from "next/link";
import { Package, FolderOpen, ShoppingBag, Users, BarChart3 } from "lucide-react";
import { siteConfig } from "@/config/site";
import { adminNavigation } from "@/config/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

async function getDashboardStats() {
  const supabase = await getSupabaseServerClient();

  const [productsRes, ordersRes, customersRes, revenueRes] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date().toISOString().slice(0, 10)),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("total_amount")
      .eq("status", "PAID")
      .gte(
        "created_at",
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      ),
  ]);

  const monthlyRevenue = (revenueRes.data ?? []).reduce(
    (sum, o) => sum + (o.total_amount ?? 0),
    0,
  );

  return {
    productCount: productsRes.count ?? 0,
    ordersToday: ordersRes.count ?? 0,
    customerCount: customersRes.count ?? 0,
    monthlyRevenue,
  };
}

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  const metrics = [
    {
      label: "Đơn hàng hôm nay",
      value: String(stats.ordersToday),
      icon: ShoppingBag,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Doanh thu tháng",
      value: formatCurrency(stats.monthlyRevenue),
      icon: BarChart3,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Sản phẩm",
      value: String(stats.productCount),
      icon: Package,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "Khách hàng",
      value: String(stats.customerCount),
      icon: Users,
      color: "text-orange-600 bg-orange-50",
    },
  ];

  return (
    <div className="flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 min-h-[calc(100vh-2.5rem)] p-4">
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-900">
            {siteConfig.name}
          </h2>
          <p className="text-xs text-slate-500">Quản trị</p>
        </div>
        <nav className="space-y-1">
          {adminNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((metric) => (
            <div key={metric.label} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${metric.color}`}>
                  <metric.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
                  <p className="text-xs text-slate-500">{metric.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/products/new" className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
            <Package className="w-8 h-8 text-blue-500" />
            <div>
              <p className="font-medium text-slate-900">Thêm sản phẩm</p>
              <p className="text-xs text-slate-500">Tạo sản phẩm mới</p>
            </div>
          </Link>
          <Link href="/admin/categories" className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
            <FolderOpen className="w-8 h-8 text-purple-500" />
            <div>
              <p className="font-medium text-slate-900">Quản lý danh mục</p>
              <p className="text-xs text-slate-500">Thêm, sửa danh mục</p>
            </div>
          </Link>
          <Link href="/admin/orders" className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
            <ShoppingBag className="w-8 h-8 text-green-500" />
            <div>
              <p className="font-medium text-slate-900">Đơn hàng</p>
              <p className="text-xs text-slate-500">Xem đơn hàng mới</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
