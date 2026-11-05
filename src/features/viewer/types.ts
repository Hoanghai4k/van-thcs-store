/**
 * Secure Full Document Viewer Types.
 *
 * Strict security boundary:
 * - NO master storage paths
 * - NO R2 storage prefixes
 * - NO source file SHA-256 hashes
 * - NO service-role keys or infrastructure internals
 */

export interface SafeViewerDocument {
  documentKey: string;
  name: string;
  pageCount: number;
}

export interface SafeViewerFile {
  fileId: string;
  fileName: string;
  isViewable: boolean;
  statusMessage?: string;
  pageCount?: number;
  documents: SafeViewerDocument[];
}

export interface SafeViewerMetadata {
  productId: string;
  productName: string;
  productSlug: string | null;
  files: SafeViewerFile[];
  hasAnyViewable: boolean;
}

export interface PageUrlResponse {
  url: string;
  expiresIn: number;
}

