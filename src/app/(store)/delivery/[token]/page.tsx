/**
 * Delivery token entry route.
 *
 * Flow:
 * 1. Raw token from URL path
 * 2. Hash token → lookup download_tokens by hash
 * 3. Validate (not expired, not revoked, order PAID)
 * 4. Set delivery access cookie
 * 5. Redirect to /order/{orderCode}/downloads
 *
 * After redirect, the raw token is no longer visible in the URL,
 * reducing exposure in browser history, referrer headers, and screenshots.
 *
 * SECURITY:
 * - Raw token is never stored server-side or logged
 * - Token is validated before any cookie is issued
 * - Redirect removes token from visible URL
 */

import { redirect } from "next/navigation";
import { ShieldX } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DeliveryEntryPage({ params, searchParams }: Props) {
  const { token: rawToken } = await params;
  const resolvedSearchParams = await searchParams;
  const error = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : undefined;

  if (error) {
    let message = "Liên kết nhận tài liệu không hợp lệ hoặc đã hết hạn.";
    if (error === "invalid_token") {
      message = "Liên kết nhận tài liệu không hợp lệ.";
    } else if (error === "not_eligible") {
      message = "Đơn hàng chưa đủ điều kiện tải tài liệu.";
    } else if (error === "system") {
      message = "Hệ thống đang gặp sự cố. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.";
    }
    return <DeliveryError message={message} />;
  }

  if (!rawToken || rawToken === "invalid") {
    return <DeliveryError message="Liên kết nhận tài liệu không hợp lệ." />;
  }

  // Redirect to activation Route Handler to validate and securely set cookies
  redirect(`/api/delivery/${rawToken}`);
}

function DeliveryError({ message }: { message: string }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">
          Liên kết nhận tài liệu không còn hiệu lực
        </h1>
        <p className="text-text-secondary mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/orders"
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors text-center"
          >
            Đơn hàng của tôi
          </Link>
          <Link
            href="/order/lookup"
            className="px-6 py-3 border border-border text-text-primary font-medium rounded-xl hover:bg-surface-alt transition-colors text-center"
          >
            Tra cứu bằng mã đơn
          </Link>
        </div>
        <div className="mt-8 text-center text-sm text-text-muted">
          Cần hỗ trợ? <a href="/contact" className="text-primary-600 hover:underline">Liên hệ với chúng tôi</a>
        </div>
      </div>
    </div>
  );
}
