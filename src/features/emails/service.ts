/**
 * Email service.
 *
 * Sends transactional emails (order confirmation, download links, etc.)
 * TODO: Integrate with an email provider (Resend, SendGrid, etc.)
 */

/**
 * Send order confirmation email with download links.
 */
export async function sendOrderConfirmationEmail(_data: {
  customerEmail: string;
  customerName: string;
  orderCode: string;
  items: Array<{ productName: string; downloadUrl: string }>;
  totalAmount: number;
}): Promise<boolean> {
  // TODO: Implement with email provider
  console.log("[Email] Order confirmation email queued (not sent - provider not configured)");
  return false;
}

/**
 * Send download link email.
 */
export async function sendDownloadLinkEmail(_data: {
  customerEmail: string;
  customerName: string;
  productName: string;
  downloadUrl: string;
}): Promise<boolean> {
  // TODO: Implement with email provider
  console.log("[Email] Download link email queued (not sent - provider not configured)");
  return false;
}
