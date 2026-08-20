import { Mail, MessageSquare } from "lucide-react";
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
        <div className="bg-white rounded-2xl border border-border p-6 text-center">
          <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-primary-500" />
          </div>
          <h2 className="font-semibold text-text-primary mb-2">Kênh hỗ trợ</h2>
          <p className="text-text-secondary text-sm">
            Thông tin liên hệ đang được cập nhật.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 text-center">
          <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-primary-500" />
          </div>
          <h2 className="font-semibold text-text-primary mb-2">Hỗ trợ đơn hàng</h2>
          <p className="text-sm text-text-secondary">
            Kèm mã đơn hàng khi liên hệ để được hỗ trợ nhanh hơn.
          </p>
        </div>
      </div>
    </div>
  );
}
