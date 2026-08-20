/**
 * Delivery email template.
 *
 * Vietnamese transactional email sent after successful payment.
 * Contains a secure delivery link — NEVER contains signed URLs
 * or storage paths.
 */

import { siteConfig } from "@/config/site";
import { formatCurrency } from "@/lib/utils";

export interface DeliveryEmailData {
  customerName: string;
  orderCode: string;
  deliveryUrl: string;
  expiryDays: number;
  items: Array<{ productName: string; unitPrice: number }>;
  totalAmount: number;
}

export function buildDeliveryEmailSubject(orderCode: string): string {
  return `Tài liệu của bạn – Đơn hàng ${orderCode}`;
}

export function buildDeliveryEmailHtml(data: DeliveryEmailData): string {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 14px; color: #333;">
          ${escapeHtml(item.productName)}
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 14px; color: #333; text-align: right;">
          ${formatCurrency(item.unitPrice)}
        </td>
      </tr>`,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${buildDeliveryEmailSubject(data.orderCode)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
          ${escapeHtml(siteConfig.name)}
        </h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
          Thanh toán thành công ✓
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 32px 24px;">
        <p style="margin: 0 0 16px; font-size: 16px; color: #333;">
          Xin chào <strong>${escapeHtml(data.customerName)}</strong>,
        </p>
        <p style="margin: 0 0 24px; font-size: 14px; color: #555; line-height: 1.6;">
          Cảm ơn bạn đã mua hàng! Đơn hàng <strong>${escapeHtml(data.orderCode)}</strong> 
          đã được thanh toán thành công. Tài liệu của bạn đã sẵn sàng để tải xuống.
        </p>

        <!-- Order Items -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr>
              <th style="padding: 8px 0; border-bottom: 2px solid #eee; font-size: 12px; text-transform: uppercase; color: #888; text-align: left;">
                Sản phẩm
              </th>
              <th style="padding: 8px 0; border-bottom: 2px solid #eee; font-size: 12px; text-transform: uppercase; color: #888; text-align: right;">
                Giá
              </th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
          <tfoot>
            <tr>
              <td style="padding: 12px 0; font-size: 15px; font-weight: 700; color: #333;">
                Tổng cộng
              </td>
              <td style="padding: 12px 0; font-size: 15px; font-weight: 700; color: #2563eb; text-align: right;">
                ${formatCurrency(data.totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${escapeHtml(data.deliveryUrl)}" 
             style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
            Nhận tài liệu
          </a>
        </div>

        <p style="margin: 0 0 8px; font-size: 12px; color: #888; text-align: center;">
          Liên kết có hiệu lực trong ${data.expiryDays} ngày.
        </p>

        <!-- Support -->
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="margin: 0; font-size: 13px; color: #888; line-height: 1.5;">
            Nếu bạn gặp vấn đề khi tải tài liệu, vui lòng liên hệ qua trang
            <a href="${escapeHtml(siteConfig.url)}/contact" style="color: #2563eb;">
              Liên hệ
            </a>
            của chúng tôi.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding: 16px 24px; background-color: #f9fafb; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #aaa;">
          ${escapeHtml(siteConfig.footer.copyright)}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
