import { MessageSquare, Phone } from "lucide-react";
import { siteConfig } from "@/config/site";

export const metadata = { title: `Liên hệ | ${siteConfig.name}` };

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-text-primary mb-2 text-center">Liên hệ</h1>
      <p className="text-text-secondary text-center mb-10">
        Chúng tôi luôn sẵn sàng hỗ trợ bạn.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Zalo Card */}
        <div className="bg-surface rounded-2xl border border-border p-6 text-center shadow-sm flex flex-col h-full">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-4 flex-shrink-0">
            <Phone className="w-6 h-6 text-blue-500 dark:text-blue-400" aria-hidden="true" />
          </div>
          <h2 className="font-semibold text-text-primary mb-2">Zalo hỗ trợ</h2>
          <p className="font-medium text-lg text-primary-600 dark:text-primary-400 mb-2">
            {siteConfig.support.zaloPhone}
          </p>
          <p className="text-text-secondary text-sm flex-grow mb-6">
            Nhắn Zalo để được hỗ trợ nhanh về tài liệu và đơn hàng.
          </p>
          <a
            href={siteConfig.support.zaloUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
          >
            Nhắn qua Zalo
          </a>
        </div>

        {/* Facebook Card */}
        <div className="bg-surface rounded-2xl border border-border p-6 text-center shadow-sm flex flex-col h-full">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-4 flex-shrink-0">
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          </div>
          <h2 className="font-semibold text-text-primary mb-2">Facebook</h2>
          <div className="h-[28px] mb-2" /> {/* Spacer to align with Zalo phone number */}
          <p className="text-text-secondary text-sm flex-grow mb-6">
            Liên hệ qua Facebook nếu bạn cần tư vấn thêm về tài liệu.
          </p>
          <a
            href={siteConfig.support.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            Nhắn qua Facebook
          </a>
        </div>
      </div>
      
      <p className="text-sm text-text-muted text-center mt-8">
        Nếu cần hỗ trợ đơn hàng, vui lòng gửi kèm mã đơn VTS-... để được xử lý nhanh hơn.
      </p>
    </div>
  );
}
