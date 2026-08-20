import { siteConfig } from "@/config/site";

export const metadata = { title: `Chính sách bảo mật | ${siteConfig.name}` };

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Chính sách bảo mật</h1>
      <div className="prose prose-sm text-text-secondary max-w-none space-y-4">
        <p>{siteConfig.name} cam kết bảo vệ thông tin cá nhân của khách hàng.</p>
        <h2 className="text-lg font-semibold text-text-primary">Thông tin thu thập</h2>
        <p>Chúng tôi thu thập: họ tên, email, số điện thoại khi bạn đặt hàng để xử lý đơn hàng và gửi tài liệu.</p>
        <h2 className="text-lg font-semibold text-text-primary">Sử dụng thông tin</h2>
        <p>Thông tin chỉ được sử dụng để xử lý đơn hàng, gửi tài liệu, và hỗ trợ khách hàng. Không chia sẻ cho bên thứ ba.</p>
        <h2 className="text-lg font-semibold text-text-primary">Bảo mật thanh toán</h2>
        <p>Thanh toán được xử lý qua cổng thanh toán bảo mật. Chúng tôi không lưu trữ thông tin thẻ.</p>
        <p>Mọi thắc mắc về bảo mật, vui lòng liên hệ qua trang <a href="/contact" className="text-primary-600 hover:underline">Liên hệ</a>.</p>
      </div>
    </div>
  );
}
