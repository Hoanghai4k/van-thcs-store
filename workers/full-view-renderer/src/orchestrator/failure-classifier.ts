import { RendererError, type RendererErrorCode } from "../errors.js";

export interface FailureClassification {
  status: "FAILED_RETRYABLE" | "FAILED_FINAL";
  errorCode: string;
  errorMessage: string;
}

const RETRYABLE_CODES = new Set<string>([
  "RENDER_TIMEOUT",
  "TEMPORARY_STORAGE_ERROR",
  "NETWORK_UPLOAD_ERROR",
  "STORAGE_VERIFICATION_FAILED",
  "DOCX_RUNTIME_UNAVAILABLE", // Environmental: container needs LibreOffice package; job can be retried once fixed
]);

/**
 * Strips sensitive data (passwords, tokens, service role keys, signed URLs)
 * and truncates diagnostic error messages for safe storage in PostgreSQL.
 */
export function sanitizeErrorMessage(message: string, maxLength: number = 500): string {
  if (!message) return "Unknown error";

  let sanitized = message
    // Strip URLs with query parameters (tokens, signatures, presigned URLs)
    .replace(/https?:\/\/[^\s?]+\?[^\s]+/gi, "[REDACTED_PRESIGNED_URL]")
    // Strip JWT / Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED_TOKEN]")
    // Strip API keys / secrets
    .replace(/(key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9\-._~+/]+['"]?/gi, "$1=[REDACTED]")
    // Strip newlines / tabs to keep single-line diagnostic
    .replace(/[\r\n\t]+/g, " ")
    .trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + "...";
  }

  return sanitized;
}

/**
 * Classifies an exception into Migration 016 FAILED_RETRYABLE or FAILED_FINAL status.
 */
export function classifyFailure(err: unknown): FailureClassification {
  if (err instanceof RendererError) {
    const isRetryable = RETRYABLE_CODES.has(err.code);
    return {
      status: isRetryable ? "FAILED_RETRYABLE" : "FAILED_FINAL",
      errorCode: err.code,
      errorMessage: sanitizeErrorMessage(err.message),
    };
  }

  // Handle generic / network / filesystem errors
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const isNetworkOrTimeout =
      msg.includes("timeout") ||
      msg.includes("network") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("econnrefused");

    return {
      status: isNetworkOrTimeout ? "FAILED_RETRYABLE" : "FAILED_FINAL",
      errorCode: isNetworkOrTimeout ? "NETWORK_UPLOAD_ERROR" : "UNEXPECTED_ERROR",
      errorMessage: sanitizeErrorMessage(err.message),
    };
  }

  return {
    status: "FAILED_FINAL",
    errorCode: "UNKNOWN_ERROR",
    errorMessage: sanitizeErrorMessage(String(err)),
  };
}
