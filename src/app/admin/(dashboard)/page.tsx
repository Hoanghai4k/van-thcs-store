import Link from "next/link";
import { Package, FolderOpen, ShoppingBag, Users, BarChart3, AlertCircle, Clock, CheckCircle2, FileWarning } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

async function getDashboardStats() {
  const supabase = await getSupabaseServerClient();

  // Basic KPIs
  const [productsRes, ordersTodayRes, customersRes, revenueRes] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
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

  // Operational Alerts
  const [pendingOrdersRes, recentPaidOrdersRes, draftProductsRes, noFileProductsRes] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "PAID").gte("updated_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()), // Last 3 days
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", false),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("file_count", 0),
  ]);

  const monthlyRevenue = (revenueRes.data ?? []).reduce(
    (sum, o) => sum + (o.total_amount ?? 0),
    0,
  );

  return {
    productCount: productsRes.count ?? 0,
    ordersToday: ordersTodayRes.count ?? 0,
    customerCount: customersRes.count ?? 0,
    monthlyRevenue,
    alerts: {
      pendingOrders: pendingOrdersRes.count ?? 0,
      recentPaidOrders: recentPaidOrdersRes.count ?? 0,
      draftProducts: draftProductsRes.count ?? 0,
      noFileProducts: noFileProductsRes.count ?? 0,
    }
  };
}

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  const metrics = [
    {
      label: "Đơn hàng hôm nay",
      value: String(stats.ordersToday),
      icon: ShoppingBag,
      color: "text-primary-600 bg-primary-50 border-primary-100",
    },
    {
      label: "Doanh thu tháng",
      value: formatCurrency(stats.monthlyRevenue),
      icon: BarChart3,
      color: "text-green-600 bg-green-50 border-green-100",
    },
    {
      label: "Sản phẩm đang bán",
      value: String(stats.productCount),
      icon: Package,
      color: "text-purple-600 bg-purple-50 border-purple-100",
    },
    {
      label: "Khách hàng",
      value: String(stats.customerCount),
      icon: Users,
      color: "text-orange-600 bg-orange-50 border-orange-100",
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Tổng quan</h1>
        <p className="text-slate-500 text-sm">Chào mừng bạn quay lại không gian quản trị.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((metric) => (
          <div key={metric.label} className={`bg-white rounded-xl border p-5 shadow-sm ${metric.color.split(' ')[2] || 'border-slate-200'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${metric.color.split(' ').slice(0,2).join(' ')}`}>
                <metric.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
                <p className="text-sm font-medium text-slate-500">{metric.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Links */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary-500 rounded-full inline-block"></span>
              Thao tác nhanh
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href="/admin/products/new" className="group flex flex-col items-center justify-center gap-3 bg-white rounded-xl border border-slate-200 p-6 hover:border-primary-400 hover:shadow-md transition-all text-center">
                <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 mb-1">Thêm sản phẩm</p>
                  <p className="text-xs text-slate-500">Tạo mới tài liệu</p>
                </div>
              </Link>
              
              <Link href="/admin/categories" className="group flex flex-col items-center justify-center gap-3 bg-white rounded-xl border border-slate-200 p-6 hover:border-purple-400 hover:shadow-md transition-all text-center">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 mb-1">Danh mục</p>
                  <p className="text-xs text-slate-500">Quản lý phân loại</p>
                </div>
              </Link>
              
              <Link href="/admin/orders" className="group flex flex-col items-center justify-center gap-3 bg-white rounded-xl border border-slate-200 p-6 hover:border-green-400 hover:shadow-md transition-all text-center">
                <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 mb-1">Đơn hàng</p>
                  <p className="text-xs text-slate-500">Xem và xử lý</p>
                </div>
              </Link>
            </div>
          </section>
        </div>

        <div>
          {/* Operational Alerts */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-orange-500 rounded-full inline-block"></span>
              Cảnh báo vận hành
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="divide-y divide-slate-100">
                <Link href="/admin/orders?status=PENDING" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm font-medium text-slate-700">Đơn chờ thanh toán</span>
                  </div>
                  <span className="bg-yellow-100 text-yellow-700 font-bold px-2.5 py-0.5 rounded-full text-xs">
                    {stats.alerts.pendingOrders}
                  </span>
                </Link>
                <Link href="/admin/orders?status=PAID" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium text-slate-700">Đã thanh toán (3 ngày)</span>
                  </div>
                  <span className="bg-green-100 text-green-700 font-bold px-2.5 py-0.5 rounded-full text-xs">
                    {stats.alerts.recentPaidOrders}
                  </span>
                </Link>
                <Link href="/admin/products?status=inactive" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Sản phẩm nháp</span>
                  </div>
                  <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-0.5 rounded-full text-xs">
                    {stats.alerts.draftProducts}
                  </span>
                </Link>
                <Link href="/admin/products" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileWarning className="w-5 h-5 text-red-400" />
                    <span className="text-sm font-medium text-slate-700">SP chưa có file</span>
                  </div>
                  <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${stats.alerts.noFileProducts > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                    {stats.alerts.noFileProducts}
                  </span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
