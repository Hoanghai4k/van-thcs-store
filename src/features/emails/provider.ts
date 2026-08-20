/**
 * Email provider interface.
 *
 * Abstracts email sending so the provider can be swapped
 * (e.g., Resend → SendGrid) without changing business logic.
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Provider-specific idempotency key to prevent duplicate sends */
  idempotencyKey?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(params: SendEmailParams): Promise<EmailResult>;
}
