import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { siteConfig } from "@/config/site";
import { requireCustomer } from "@/lib/auth/customer-auth";
import { getCustomerLibrary } from "@/features/account/library-queries";
import { LibraryView } from "@/components/account/library-view";

export const metadata: Metadata = {
  title: `Tài liệu của tôi | ${siteConfig.name}`,
  description: "Các tài liệu bạn đã mua và tài liệu tặng kèm trong thư viện của bạn.",
};

export default async function AccountLibraryPage() {
  await requireCustomer("/account/library");
  const items = await getCustomerLibrary();

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12 max-w-6xl">
      {/* Back Link */}
      <div className="mb-6">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại tài khoản</span>
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
              Tài liệu của tôi
            </h1>
          </div>
          <p className="text-sm text-text-secondary">
            Các tài liệu bạn đã mua và tài liệu tặng kèm sẽ xuất hiện tại đây.
          </p>
        </div>

        {items.length > 0 && (
          <div className="text-sm text-text-secondary bg-surface-alt px-3.5 py-1.5 rounded-xl border border-border self-start sm:self-center">
            Tổng cộng: <strong className="text-text-primary">{items.length}</strong> tài liệu
          </div>
        )}
      </div>

      {/* Library View with Filtering & Cards */}
      <LibraryView items={items} />
    </div>
  );
}
