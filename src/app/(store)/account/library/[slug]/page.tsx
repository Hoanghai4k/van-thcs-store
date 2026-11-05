import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, Sparkles, BookOpen } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getCurrentAuthUser, getCurrentCustomer } from "@/lib/auth/customer-auth";
import { verifyProductEntitlement } from "@/features/account/library-queries";
import { getViewerMetadataForProduct } from "@/features/viewer/viewer-service";
import { DocumentViewer } from "@/components/viewer/document-viewer";
import { maskEmail } from "@/lib/utils";

interface ViewerPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ViewerPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Xem tài liệu ${slug} trực tuyến | ${siteConfig.name}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function FullViewerPage({ params }: ViewerPageProps) {
  const { slug } = await params;

  // 1. Verify authenticated session
  const user = await getCurrentAuthUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/account/library/${slug}`)}`);
  }

  // 2. Resolve linked customer business profile
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect(`/login?redirect=${encodeURIComponent(`/account/library/${slug}`)}`);
  }

  // 3. Centralized entitlement verification (enforcing database RLS)
  const entitlement = await verifyProductEntitlement(slug);

  // 4. Access Denied / Not Entitled UX
  if (!entitlement.entitled) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-xl text-center">
        <div className="bg-surface rounded-2xl border border-border p-8 sm:p-12 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary mb-3">
            Bạn chưa có quyền xem tài liệu này
          </h1>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            Quyền xem bản đầy đủ chỉ dành cho tài khoản đã mua tài liệu này hoặc được tặng kèm hợp lệ trong đơn hàng đã thanh toán.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/account/library"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition-colors shadow-sm"
            >
              <BookOpen className="w-4 h-4" />
              <span>Về Thư viện của tôi</span>
            </Link>

            <Link
              href={`/products/${slug}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface-alt hover:bg-surface text-text-secondary hover:text-text-primary border border-border font-medium text-sm transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Xem giới thiệu tài liệu</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 5. Entitlement positively verified: fetch safe viewer metadata via service role
  const viewerMetadata = await getViewerMetadataForProduct(entitlement.product.id);
  const maskedEmail = maskEmail(customer.email);

  // 6. Render full document viewer
  return (
    <DocumentViewer
      metadata={viewerMetadata}
      customerEmailMasked={maskedEmail}
    />
  );
}
