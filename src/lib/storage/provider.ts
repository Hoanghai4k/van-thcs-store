/**
 * Product file storage provider abstraction.
 *
 * Routes operations to the correct backend (Supabase Storage or Cloudflare R2)
 * based on the product_files.storage_provider column.
 *
 * Business logic (entitlement, authorization) is NOT duplicated here —
 * provider selection happens only AFTER authorization checks pass.
 *
 * Server-only module — NEVER import in client components.
 */

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getR2Client, getR2BucketName } from "./r2-client";
import { STORAGE_BUCKETS, StorageProvider } from "@/lib/constants";

// ─── Interface ────────────────────────────────────────────────────

export interface ProductFileStorageProvider {
  /**
   * Generate a short-lived download URL for a product file.
   * @param storagePath - The object key / storage path
   * @param ttlSeconds - URL lifetime in seconds
   * @param downloadFilename - Content-Disposition filename for the browser
   */
  createDownloadUrl(
    storagePath: string,
    ttlSeconds: number,
    downloadFilename: string,
  ): Promise<string>;

  /**
   * Delete a product file object from storage.
   */
  deleteObject(storagePath: string): Promise<void>;

  /**
   * Get a signed URL for server-side access (e.g. CloudConvert preview pipeline).
   * The URL should be valid for the given TTL.
   */
  getSourceUrl(storagePath: string, ttlSeconds: number): Promise<string>;
}

// ─── Supabase Implementation ─────────────────────────────────────

export class SupabaseProductFileStorage implements ProductFileStorageProvider {
  constructor(private supabaseAdmin: SupabaseClient<Database>) {}

  async createDownloadUrl(
    storagePath: string,
    ttlSeconds: number,
    downloadFilename: string,
  ): Promise<string> {
    const { data, error } = await this.supabaseAdmin.storage
      .from(STORAGE_BUCKETS.PRODUCT_FILES)
      .createSignedUrl(storagePath, ttlSeconds, {
        download: downloadFilename,
      });

    if (error || !data?.signedUrl) {
      console.error("[SupabaseStorage] Signed URL error:", error?.message);
      throw new Error("Không thể tạo liên kết tải xuống từ Supabase.");
    }

    return data.signedUrl;
  }

  async deleteObject(storagePath: string): Promise<void> {
    const { error } = await this.supabaseAdmin.storage
      .from(STORAGE_BUCKETS.PRODUCT_FILES)
      .remove([storagePath]);

    if (error) {
      console.error("[SupabaseStorage] Delete error:", error.message);
      throw new Error("Không thể xóa file từ Supabase Storage.");
    }
  }

  async getSourceUrl(storagePath: string, ttlSeconds: number): Promise<string> {
    const { data, error } = await this.supabaseAdmin.storage
      .from(STORAGE_BUCKETS.PRODUCT_FILES)
      .createSignedUrl(storagePath, ttlSeconds);

    if (error || !data?.signedUrl) {
      console.error("[SupabaseStorage] Source URL error:", error?.message);
      throw new Error("Không thể truy cập tệp nguồn từ Supabase.");
    }

    return data.signedUrl;
  }
}

// ─── R2 Implementation ───────────────────────────────────────────

export class R2ProductFileStorage implements ProductFileStorageProvider {
  async createDownloadUrl(
    storagePath: string,
    ttlSeconds: number,
    downloadFilename: string,
  ): Promise<string> {
    const client = getR2Client();
    const bucket = getR2BucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(downloadFilename)}"`,
    });

    return getSignedUrl(client, command, { expiresIn: ttlSeconds });
  }

  async deleteObject(storagePath: string): Promise<void> {
    const client = getR2Client();
    const bucket = getR2BucketName();

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: storagePath,
        }),
      );
    } catch (err) {
      console.error("[R2Storage] Delete error:", err);
      throw new Error("Không thể xóa file từ R2.");
    }
  }

  async getSourceUrl(storagePath: string, ttlSeconds: number): Promise<string> {
    const client = getR2Client();
    const bucket = getR2BucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storagePath,
    });

    return getSignedUrl(client, command, { expiresIn: ttlSeconds });
  }

  /**
   * Server-side HEAD check — used after multipart upload to verify
   * the object exists and has the expected size.
   */
  async headObject(storagePath: string): Promise<{ contentLength: number }> {
    const client = getR2Client();
    const bucket = getR2BucketName();

    const result = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: storagePath,
      }),
    );

    return { contentLength: result.ContentLength ?? 0 };
  }
}

// ─── Factory ─────────────────────────────────────────────────────

const r2Instance = new R2ProductFileStorage();

/**
 * Get the correct storage provider implementation for a product file.
 *
 * @param storageProvider - The storage_provider value from the DB row
 * @param supabaseAdmin - Required for SUPABASE provider; optional for R2
 */
export function getProductFileProvider(
  storageProvider: string,
  supabaseAdmin?: SupabaseClient<Database>,
): ProductFileStorageProvider {
  switch (storageProvider) {
    case StorageProvider.SUPABASE:
      if (!supabaseAdmin) {
        throw new Error("Supabase admin client is required for SUPABASE storage provider.");
      }
      return new SupabaseProductFileStorage(supabaseAdmin);

    case StorageProvider.R2:
      return r2Instance;

    default:
      console.error(`[StorageProvider] Unknown provider: ${storageProvider}`);
      throw new Error(`Nhà cung cấp lưu trữ không xác định: ${storageProvider}`);
  }
}
