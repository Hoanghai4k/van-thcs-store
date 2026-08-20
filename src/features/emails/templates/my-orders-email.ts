/**
 * My Orders magic link email template.
 */

export function buildMyOrdersEmailSubject(): string {
  return "Xem đơn hàng của bạn – Tài Liệu Hằng Cao";
}

export function buildMyOrdersEmailHtml(params: { verifyUrl: string }): string {
  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>Xác minh email của bạn</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333333;
          background-color: #f9f9f9;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          padding: 32px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        h1 {
          font-size: 24px;
          margin-bottom: 24px;
          color: #111111;
        }
        p {
          margin-bottom: 16px;
        }
        .button {
          display: inline-block;
          background-color: #000000;
          color: #ffffff;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 4px;
          font-weight: bold;
          margin-top: 16px;
          margin-bottom: 24px;
        }
        .footer {
          font-size: 14px;
          color: #666666;
          margin-top: 32px;
          border-top: 1px solid #eeeeee;
          padding-top: 16px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Xem đơn hàng của bạn</h1>
        <p>Chào bạn,</p>
        <p>Bạn vừa yêu cầu truy cập danh sách đơn hàng của mình tại <strong>Văn THCS Store</strong>. Hãy nhấn vào nút bên dưới để xác minh và xem đơn hàng của bạn:</p>
        
        <a href="${params.verifyUrl}" class="button">Xem đơn hàng của tôi</a>
        
        <p style="color: #d97706; font-size: 14px;">
          <strong>Lưu ý:</strong> Liên kết này chỉ có hiệu lực trong vòng 15 phút.
        </p>

        <div class="footer">
          <p>Nếu bạn không yêu cầu email này, bạn có thể bỏ qua nó một cách an toàn.</p>
          <p>Cảm ơn bạn đã đồng hành cùng Văn THCS Store!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
