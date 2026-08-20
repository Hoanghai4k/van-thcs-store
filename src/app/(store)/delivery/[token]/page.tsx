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
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { validateDeliveryToken } from "@/features/downloads/service";
import { setDeliveryAccessCookieServerAction } from "@/lib/auth/delivery-access";
import { ShieldX } from "lucide-react";
import { siteConfig } from "@/config/site";
import Link from "next/link";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function DeliveryEntryPage({ params }: Props) {
  const { token: rawToken } = await params;

  if (!rawToken) {
    return <DeliveryError message="Liên kết nhận tài liệu không hợp lệ." />;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const result = await validateDeliveryToken(rawToken, supabaseAdmin);

  if (!result.valid || !result.grant || !result.orderCode) {
    return <DeliveryError message={result.error ?? "Liên kết nhận tài liệu không hợp lệ hoặc đã hết hạn."} />;
  }

  // Set delivery access cookie
  await setDeliveryAccessCookieServerAction(
    result.grant.id,
    result.grant.orderId,
  );

  // Redirect to clean URL — raw token no longer in browser URL
  redirect(`/order/${result.orderCode}/downloads`);
}

function DeliveryError({ message }: { message: string }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">
          Liên kết không hợp lệ
        </h1>
        <p className="text-text-secondary mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/order/lookup"
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors text-center"
          >
            Tra cứu đơn hàng
          </Link>
          <Link
            href="/products"
            className="px-6 py-3 border border-border text-text-primary font-medium rounded-xl hover:bg-surface-alt transition-colors text-center"
          >
            Tiếp tục mua sắm
          </Link>
        </div>
        <p className="text-xs text-text-muted mt-6">
          Cần hỗ trợ? Liên hệ {siteConfig.contact.email}
        </p>
      </div>
    </div>
  );
}
