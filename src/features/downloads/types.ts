/**
 * Download types.
 */

export interface DownloadTokenData {
  id: string;
  orderId: string;
  productId: string;
  token: string;
  expiresAt: string;
  maxDownloads: number;
  downloadCount: number;
}

export interface DownloadValidationResult {
  valid: boolean;
  error?: string;
  productId?: string;
  orderId?: string;
  fileName?: string;
  storagePath?: string;
}
