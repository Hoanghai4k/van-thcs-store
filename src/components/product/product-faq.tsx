import Link from "next/link";

/**
 * FAQ accordion for product detail pages.
 * Uses native <details>/<summary> for zero-JS accordion behavior.
 */
export function ProductFAQ() {
  const faqs = [
    {
      question: "Tôi nhận file bằng cách nào?",
      answer:
        "Sau khi hệ thống xác nhận thanh toán, bạn sẽ nhận được link tải tài liệu qua email đã đăng ký. Bạn cũng có thể tra cứu đơn hàng để tải lại.",
    },
    {
      question: "File có chỉnh sửa được không?",
      answer:
        "Có. Sản phẩm định dạng DOCX có thể mở và chỉnh sửa bằng Microsoft Office, Google Docs hoặc LibreOffice. Sản phẩm ZIP chứa bộ tài liệu đầy đủ.",
    },
    {
      question: "Tôi có thể tải lại file không?",
      answer:
        "Có. Mỗi đơn hàng được cấp link tải có giới hạn số lần tải và thời gian hiệu lực. Nếu gặp vấn đề, vui lòng liên hệ hỗ trợ.",
    },
    {
      question: "Có hoàn tiền không?",
      answer: "refund-link", // Special marker for refund policy link
    },
  ];

  return (
    <section>
      <h2 className="text-lg font-bold text-text-primary mb-4">
        Câu hỏi thường gặp
      </h2>
      <div className="space-y-2">
        {faqs.map((faq, idx) => (
          <details
            key={idx}
            className="group bg-surface border border-border rounded-xl overflow-hidden shadow-sm"
          >
            <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer text-sm font-medium text-text-primary hover:bg-surface-alt transition-colors list-none [&::-webkit-details-marker]:hidden">
              {faq.question}
              <span className="ml-2 text-text-muted group-open:rotate-180 transition-transform duration-200">
                ▾
              </span>
            </summary>
            <div className="px-5 pb-4 text-sm text-text-secondary leading-relaxed">
              {faq.answer === "refund-link" ? (
                <p>
                  Vui lòng xem{" "}
                  <Link
                    href="/refund-policy"
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline"
                  >
                    chính sách hoàn tiền
                  </Link>{" "}
                  để biết chi tiết.
                </p>
              ) : (
                <p>{faq.answer}</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
