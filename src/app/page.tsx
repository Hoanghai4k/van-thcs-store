import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Download,
  CreditCard,
  Shield,
  Clock,
  FileText,
  Star,
  CheckCircle,
  ChevronDown,
  Zap,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { getFeaturedProducts, getCategories } from "@/features/products/queries";
import { ProductCard } from "@/components/product/product-card";

export default async function HomePage() {
  const [featuredProducts, categories] = await Promise.all([
    getFeaturedProducts(8),
    getCategories(),
  ]);

  return (
    <>
      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-accent-300/20 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 text-sm font-medium px-4 py-2 rounded-full mb-6 border border-white/20">
              <Zap className="w-4 h-4 text-yellow-300" />
              Tải ngay sau khi thanh toán — không cần chờ đợi
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              {siteConfig.tagline}
            </h1>

            <p className="text-lg md:text-xl text-blue-100 mb-8 leading-relaxed max-w-2xl">
              Tài liệu chất lượng — dễ dàng sử dụng, in ấn.
              Đề thi, giáo án, bài văn mẫu, bộ đề đọc hiểu... soạn bởi giáo viên giàu kinh nghiệm.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 bg-white text-primary-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98]"
              >
                Xem tài liệu
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 text-white font-medium px-8 py-3.5 rounded-xl border-2 border-white/30 hover:bg-white/10 transition-all duration-200"
              >
                Cách mua hàng
                <ChevronDown className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Categories Section ─── */}
      <section className="py-16 bg-surface-alt">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
              Danh mục tài liệu
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Phân loại rõ ràng, dễ dàng tìm kiếm tài liệu phù hợp
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group flex flex-col items-center p-5 bg-white rounded-xl border border-border hover:border-primary-200 hover:shadow-md transition-all duration-200"
              >
                <div className="w-12 h-12 bg-primary-50 group-hover:bg-primary-100 rounded-xl flex items-center justify-center mb-3 transition-colors">
                  <BookOpen className="w-6 h-6 text-primary-500" />
                </div>
                <span className="text-sm font-medium text-text-primary text-center group-hover:text-primary-600 transition-colors">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Featured Products ─── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
                Sản phẩm nổi bật
              </h2>
              <p className="text-text-secondary">
                Tài liệu được chọn lọc và bán chạy nhất
              </p>
            </div>
            <Link
              href="/products"
              className="hidden sm:flex items-center gap-1 text-primary-600 font-medium hover:text-primary-700 transition-colors"
            >
              Xem tất cả
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="text-center mt-8 sm:hidden">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-primary-600 font-medium"
            >
              Xem tất cả sản phẩm
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Benefits Section ─── */}
      <section className="py-16 bg-surface-alt">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
              Tại sao chọn {siteConfig.name}?
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: FileText,
                title: "Nhiều định dạng",
                desc: "DOCX, ZIP — tải ngay, dễ sử dụng theo nhu cầu riêng.",
              },
              {
                icon: Star,
                title: "Chất lượng cao",
                desc: "Soạn bởi giáo viên giàu kinh nghiệm, bám sát chương trình SGK mới.",
              },
              {
                icon: Download,
                title: "Tải ngay lập tức",
                desc: "Thanh toán xong là tải được ngay, không cần chờ đợi.",
              },
              {
                icon: Shield,
                title: "Thanh toán an toàn",
                desc: "Hệ thống thanh toán bảo mật, hỗ trợ nhiều phương thức.",
              },
            ].map((benefit) => (
              <div
                key={benefit.title}
                className="bg-white p-6 rounded-2xl border border-border hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-4">
                  <benefit.icon className="w-6 h-6 text-primary-500" />
                </div>
                <h3 className="font-semibold text-text-primary mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {benefit.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
              Quy trình mua hàng
            </h2>
            <p className="text-text-secondary max-w-lg mx-auto">
              Chỉ 4 bước đơn giản để sở hữu tài liệu
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                icon: BookOpen,
                title: "Chọn tài liệu",
                desc: "Duyệt danh mục và chọn tài liệu phù hợp",
              },
              {
                step: "02",
                icon: CreditCard,
                title: "Thanh toán",
                desc: "Thanh toán nhanh chóng, bảo mật",
              },
              {
                step: "03",
                icon: CheckCircle,
                title: "Xác nhận tự động",
                desc: "Hệ thống xác nhận thanh toán tự động",
              },
              {
                step: "04",
                icon: Download,
                title: "Tải tài liệu",
                desc: "Nhận link tải ngay qua email",
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 text-white font-bold text-xl rounded-2xl shadow-lg mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-text-primary mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ Section ─── */}
      <section className="py-16 bg-surface-alt">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
              Câu hỏi thường gặp
            </h2>
          </div>
          <div className="space-y-4">
            {[
              {
                q: "Tài liệu có định dạng gì?",
                a: "Tài liệu được cung cấp ở định dạng DOCX hoặc ZIP, dễ dàng sử dụng và in ấn.",
              },
              {
                q: "Tôi có thể tải lại tài liệu không?",
                a: "Có, bạn có thể tải lại tài liệu trong vòng 72 giờ sau khi mua, tối đa 5 lần.",
              },
              {
                q: "Thanh toán bằng hình thức nào?",
                a: "Hỗ trợ thanh toán qua chuyển khoản ngân hàng và các ví điện tử phổ biến.",
              },
              {
                q: "Tôi có được hoàn tiền không?",
                a: "Vì đây là sản phẩm số, chúng tôi hỗ trợ hoàn tiền trong trường hợp file lỗi hoặc không đúng mô tả.",
              },
              {
                q: "Làm sao để liên hệ hỗ trợ?",
                a: `Gửi email đến ${siteConfig.contact.email} hoặc truy cập trang Liên hệ.`,
              },
            ].map((faq) => (
              <details
                key={faq.q}
                className="group bg-white rounded-xl border border-border hover:border-primary-200 transition-colors"
              >
                <summary className="flex items-center justify-between p-5 cursor-pointer font-medium text-text-primary list-none">
                  {faq.q}
                  <ChevronDown className="w-5 h-5 text-text-muted group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-5 pb-5 text-sm text-text-secondary leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/20 blur-3xl" />
            </div>
            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-white/15 text-white/90 text-sm font-medium px-4 py-2 rounded-full mb-6">
                <Clock className="w-4 h-4" />
                Tải ngay — không cần chờ đợi
              </div>
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
                Sẵn sàng nâng cao chất lượng dạy &amp; học?
              </h2>
              <p className="text-blue-100 mb-8 max-w-lg mx-auto">
                Khám phá kho tài liệu Ngữ văn THCS chất lượng cao — tải ngay
                sau khi thanh toán.
              </p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Khám phá ngay
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
