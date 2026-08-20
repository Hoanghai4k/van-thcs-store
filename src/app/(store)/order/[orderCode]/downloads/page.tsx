/**
 * Delivery downloads page.
 *
 * Displays purchased files for download after delivery authorization.
 *
 * Authorization flow:
 * 1. Verify delivery access cookie (set by /delivery/[token])
 * 2. Verify order is PAID
 * 3. List product files from order_items → product_files
 * 4. Download buttons post to /api/downloads/[fileId]
 *
 * SECURITY:
 * - Requires valid delivery access cookie (separate from order access)
 * - Only PAID orders show files
 * - storage_path is NEVER exposed to client
 * - File IDs are safe identifiers; server resolves paths
 */

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDeliveryAccessCookie } from "@/lib/auth/delivery-access";
import { getPurchasedFiles, getActiveDeliveryGrant } from "@/features/downloads/service";
import { ORDER_STATUS } from "@/lib/constants";
import { formatFileSize } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DownloadButton } from "./download-button";

interface Props {
  params: Promise<{ orderCode: string }>;
}

export default async function DownloadsPage({ params }: Props) {
  const { orderCode } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  // 1. Find order by orderCode
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_code, status")
    .eq("order_code", orderCode)
    .single();

  if (!order) {
    redirect("/order/lookup");
  }

  // 2. Verify delivery access cookie
  const deliveryAccess = await getDeliveryAccessCookie(order.id);
  if (!deliveryAccess) {
    redirect(`/order/lookup?orderCode=${encodeURIComponent(orderCode)}`);
  }

  // 3. Verify order is PAID
  if (order.status !== ORDER_STATUS.PAID) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-text-primary mb-2">
          Đơn hàng chưa đủ điều kiện
        </h1>
        <p className="text-text-secondary mb-6">
          Đơn hàng chưa đủ điều kiện tải tài liệu.
        </p>
        <Link
          href={`/order/${orderCode}`}
          className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
        >
          Xem đơn hàng
        </Link>
      </div>
    );
  }

  // 4. Get delivery grant (for download count info)
  const grant = await getActiveDeliveryGrant(order.id, supabaseAdmin);

  // 5. Get purchased files
  const files = await getPurchasedFiles(order.id, supabaseAdmin);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Tài liệu của bạn
        </h1>
        <p className="text-text-secondary">
          Đơn hàng <span className="font-mono font-semibold">{orderCode}</span> — Thanh toán thành công
        </p>
      </div>

      {/* Download count info */}
      {grant && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 mb-6 text-center">
          Đã tải: {grant.downloadCount}/{grant.maxDownloads} lượt
        </div>
      )}

      {/* File list */}
      {files.length > 0 ? (
        <div className="bg-white rounded-2xl border border-border divide-y divide-border">
          {files.map((file) => (
            <div key={file.fileId} className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary truncate">
                  {file.productName}
                </p>
                <p className="text-sm text-text-secondary truncate">
                  {file.fileName} • {formatFileSize(file.fileSize)}
                </p>
              </div>
              <DownloadButton fileId={file.fileId} fileName={file.fileName} />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <p className="text-text-secondary">
            Tài liệu hiện không khả dụng. Vui lòng liên hệ hỗ trợ.
          </p>
        </div>
      )}

      {/* Footer links */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <Link
          href={`/order/${orderCode}`}
          className="px-6 py-3 border border-border text-text-primary font-medium rounded-xl hover:bg-surface-alt transition-colors text-center"
        >
          Xem đơn hàng
        </Link>
        <Link
          href="/products"
          className="px-6 py-3 border border-border text-text-primary font-medium rounded-xl hover:bg-surface-alt transition-colors text-center"
        >
          Tiếp tục mua sắm
        </Link>
      </div>

      <div className="mt-8 text-center text-sm text-text-muted">
        Cần hỗ trợ? <a href="/contact" className="text-primary-600 hover:underline">Liên hệ với chúng tôi</a>
      </div>
    </div>
  );
}
