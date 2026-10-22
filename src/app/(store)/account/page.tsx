import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  ShoppingBag,
  LogOut,
  User as UserIcon,
  Mail,
  Calendar,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { requireCustomer } from "@/lib/auth/customer-auth";
import { formatDate } from "@/lib/utils";
import { getCustomerLibraryCount } from "@/features/account/library-queries";
import { logoutCustomer } from "./actions";

export const metadata: Metadata = {
  title: `Tài khoản của tôi | ${siteConfig.name}`,
  description: "Quản lý thông tin tài khoản, tài liệu đã mua và đơn hàng của bạn.",
};

export default async function AccountPage() {
  const { customer } = await requireCustomer("/account");
  const libraryCount = await getCustomerLibraryCount();

  return (
    <div className="container mx-auto px-4 py-10 sm:py-16 max-w-4xl">
      {/* Header Profile Section */}
      <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 mb-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white shadow-md">
              <UserIcon className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-text-primary">
                  {customer.name}
                </h1>
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/50">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Đã xác thực
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1 text-sm text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-text-muted" />
                  <span>{customer.email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-text-muted" />
                  <span>Tham gia: {formatDate(customer.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          <form action={logoutCustomer}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          </form>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* My Library Card */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-text-primary">
                Tài liệu của tôi
              </h2>
              {libraryCount > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/50">
                  {libraryCount} tài liệu
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary mb-6">
              Truy cập tài liệu đã mua, xem trực tuyến và các tài liệu quà tặng đi kèm.
            </p>
          </div>
          <Link
            href="/account/library"
            className="inline-flex items-center justify-between w-full px-4 py-2.5 bg-surface-alt hover:bg-primary-50 dark:hover:bg-primary-950/30 text-text-primary hover:text-primary-600 font-medium text-sm rounded-xl transition-colors group"
          >
            <span>Xem tủ tài liệu</span>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>

        {/* My Orders Card */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-1">
              Đơn hàng của tôi
            </h2>
            <p className="text-sm text-text-secondary mb-6">
              Theo dõi lịch sử mua hàng, trạng thái thanh toán và hóa đơn giao dịch.
            </p>
          </div>
          <Link
            href="/orders"
            className="inline-flex items-center justify-between w-full px-4 py-2.5 bg-surface-alt hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-text-primary hover:text-emerald-600 font-medium text-sm rounded-xl transition-colors group"
          >
            <span>Tra cứu đơn hàng</span>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>
    </div>
  );
}
