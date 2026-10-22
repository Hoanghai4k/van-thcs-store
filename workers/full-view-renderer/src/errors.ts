export type RendererErrorCode =
  | "INVALID_SOURCE_PATH"
  | "UNSUPPORTED_FORMAT"
  | "EMPTY_SOURCE_FILE"
  | "SOURCE_EXCEEDS_SIZE_LIMIT"
  | "CORRUPT_PDF"
  | "ZERO_PAGE_DOCUMENT"
  | "PAGE_COUNT_EXCEEDS_LIMIT"
  | "PAGE_COUNT_EXCEEDS_NAMING_LIMIT"
  | "DIMENSIONS_EXCEED_LIMIT"
  | "RENDER_TIMEOUT"
  | "RENDER_FAILURE"
  | "VALIDATION_FAILURE"
  | "STORAGE_VERIFICATION_FAILED"
  | "TEMPORARY_STORAGE_ERROR"
  | "NETWORK_UPLOAD_ERROR"
  | "DOCX_RUNTIME_UNAVAILABLE";

export class RendererError extends Error {
  public readonly code: RendererErrorCode;
  public readonly details?: unknown;

  constructor(code: RendererErrorCode, message: string, details?: unknown) {
    super(`[${code}] ${message}`);
    this.name = "RendererError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, RendererError.prototype);
  }
}
