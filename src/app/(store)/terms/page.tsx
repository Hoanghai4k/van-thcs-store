import { siteConfig } from "@/config/site";

export const metadata = { title: `Điều khoản sử dụng | ${siteConfig.name}` };

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Điều khoản sử dụng</h1>
      <div className="prose prose-sm text-text-secondary max-w-none space-y-4">
        <p>Khi sử dụng {siteConfig.name}, bạn đồng ý với các điều khoản sau.</p>
        <h2 className="text-lg font-semibold text-text-primary">Sản phẩm số</h2>
        <p>Tất cả sản phẩm là tài liệu số dạng tệp tài liệu (DOCX, ZIP). Sau khi thanh toán, bạn sẽ nhận được link tải.</p>
        <h2 className="text-lg font-semibold text-text-primary">Quyền sử dụng</h2>
        <p>Tài liệu được cấp phép sử dụng cá nhân cho mục đích giáo dục. Không được phân phối lại hoặc bán lại.</p>
        <h2 className="text-lg font-semibold text-text-primary">Giới hạn tải</h2>
        <p>Mỗi đơn hàng được tải tối đa {siteConfig.store.maxDownloadsPerToken} lần trong vòng {siteConfig.store.deliveryTokenExpiryDays} ngày.</p>
      </div>
    </div>
  );
}
