/**
 * Resend email provider adapter.
 *
 * Implements the EmailProvider interface using the official Resend SDK.
 * Server-only — never import this in Client Components.
 *
 * SECURITY:
 * - RESEND_API_KEY is server-only (no NEXT_PUBLIC_ prefix)
 * - API key is never logged
 * - EMAIL_FROM must be a verified sender domain
 */

import { Resend } from "resend";
import type { EmailProvider, SendEmailParams, EmailResult } from "./provider";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  private client: Resend;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY is not set. Configure it in environment variables.",
      );
    }

    this.from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
    this.client = new Resend(apiKey);
  }

  async sendEmail(params: SendEmailParams): Promise<EmailResult> {
    try {
      const headers: Record<string, string> = {};
      if (params.idempotencyKey) {
        headers["Idempotency-Key"] = params.idempotencyKey;
      }

      const result = await this.client.emails.send({
        from: this.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        headers,
      });

      if (result.error) {
        console.error("[ResendProvider] Send error:", result.error.message);
        return { success: false, error: result.error.message };
      }

      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[ResendProvider] Exception:", message);
      return { success: false, error: message };
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────

let provider: EmailProvider | null = null;

/**
 * Get the email provider instance.
 * Returns null if RESEND_API_KEY is not configured.
 */
export function getEmailProvider(): EmailProvider | null {
  if (provider) return provider;

  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  try {
    provider = new ResendEmailProvider();
    return provider;
  } catch (error) {
    console.error("[Email] Failed to initialize provider:", error);
    return null;
  }
}
