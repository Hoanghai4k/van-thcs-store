import { siteConfig } from "@/config/site";

export const metadata = { title: `Chính sách hoàn tiền | ${siteConfig.name}` };

export default function RefundPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Chính sách hoàn tiền</h1>
      <div className="prose prose-sm text-text-secondary max-w-none space-y-4">
        <p>Vì sản phẩm là tài liệu số, chính sách hoàn tiền được áp dụng trong các trường hợp sau:</p>
        <h2 className="text-lg font-semibold text-text-primary">Được hoàn tiền</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>File tài liệu bị lỗi, không thể mở được.</li>
          <li>Nội dung không đúng với mô tả sản phẩm.</li>
          <li>Thanh toán thành công nhưng không nhận được link tải.</li>
        </ul>
        <h2 className="text-lg font-semibold text-text-primary">Không được hoàn tiền</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>Đã tải file thành công và file hoạt động bình thường.</li>
          <li>Thay đổi ý kiến sau khi mua.</li>
        </ul>
        <p className="text-sm text-text-secondary mt-1">
          Gửi yêu cầu kèm mã đơn hàng qua trang <a href="/contact" className="text-primary-600 hover:underline">Liên hệ</a>. Hoàn tiền trong 3-5 ngày làm việc.
        </p>
      </div>
    </div>
  );
}
