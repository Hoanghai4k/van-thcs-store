/**
 * Download / delivery types.
 *
 * These types support the secure digital delivery flow:
 *   delivery token → delivery access session → file download
 */

/** Represents a delivery grant stored in the database */
export interface DeliveryGrant {
  id: string;
  orderId: string;
  tokenHash: string;
  expiresAt: string;
  maxDownloads: number;
  downloadCount: number;
  revokedAt: string | null;
  deliveryEmailSentAt: string | null;
  deliveryEmailMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Result of creating or finding a delivery grant */
export interface EnsureDeliveryGrantResult {
  grant: DeliveryGrant;
  rawToken: string | null; // Only present when a NEW grant is created
  isNew: boolean;
}

/** Result of validating a raw delivery token */
export interface DeliveryTokenValidation {
  valid: boolean;
  error?: string;
  grant?: DeliveryGrant;
  orderId?: string;
  orderCode?: string;
}

/** Result of processing a file download request */
export interface DownloadResult {
  success: boolean;
  error?: string;
  signedUrl?: string;
  fileName?: string;
}

/** Information about a purchasable file available for download */
export interface PurchasedFile {
  fileId: string;
  productId: string;
  productName: string;
  fileName: string;
  fileSize: number;
}
