import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import { RendererError } from "../errors.js";
import type { DerivedStorage } from "./derived-storage.js";

export interface R2DerivedStorageOptions {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName: string;
  endpointOverride?: string;
  client?: S3Client;
}

export function buildR2Endpoint(accountId: string, overrideEndpoint?: string): string {
  if (overrideEndpoint) {
    const trimmed = overrideEndpoint.trim();
    if (!trimmed.startsWith("https://")) {
      throw new RendererError("VALIDATION_FAILURE", "R2_ENDPOINT must start with https://");
    }
    return trimmed;
  }

  const trimmedId = accountId.trim();
  if (!trimmedId) {
    throw new RendererError("VALIDATION_FAILURE", "R2_ACCOUNT_ID is empty.");
  }

  return `https://${trimmedId}.r2.cloudflarestorage.com`;
}

/**
 * Production Cloudflare R2 Derived Storage Adapter.
 *
 * Requirements:
 * - Uses AWS S3Client configured with Cloudflare R2 endpoints.
 * - Strictly private objects (no public ACL).
 * - deletePrefix implements pagination over ListObjectsV2 and DeleteObjects.
 * - Credential and endpoint security: never logs or leaks credentials.
 */
export class R2DerivedStorage implements DerivedStorage {
  private client: S3Client;
  private bucketName: string;

  constructor(options: R2DerivedStorageOptions) {
    this.bucketName = options.bucketName;

    if (options.client) {
      this.client = options.client;
      return;
    }

    const accountId = options.accountId ?? process.env.R2_ACCOUNT_ID;
    const accessKeyId = options.accessKeyId ?? process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = options.secretAccessKey ?? process.env.R2_SECRET_ACCESS_KEY;
    const endpointOverride = options.endpointOverride ?? process.env.R2_ENDPOINT;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new RendererError(
        "VALIDATION_FAILURE",
        "R2DerivedStorage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY"
      );
    }

    const endpoint = buildR2Endpoint(accountId, endpointOverride);

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadFile(key: string, localFilePath: string, contentType: string): Promise<void> {
    let bytes: Buffer;
    try {
      bytes = await readFile(localFilePath);
    } catch (err) {
      throw new RendererError("INVALID_SOURCE_PATH", `Cannot read file for R2 upload: ${localFilePath}`, err);
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: bytes,
          ContentType: contentType,
          // Explicitly private: no public-read ACL
        })
      );
    } catch (err) {
      throw new RendererError("NETWORK_UPLOAD_ERROR", `Failed to upload object to R2 at key '${key}'`, err);
    }
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return true;
    } catch (err: unknown) {
      const errorObj = err as Record<string, unknown> | undefined;
      const name = typeof errorObj?.name === "string" ? errorObj.name : "";
      const statusCode = typeof errorObj?.$metadata === "object" && errorObj.$metadata !== null && "$metadata" in errorObj
        ? (errorObj.$metadata as Record<string, unknown>).httpStatusCode
        : undefined;

      if (name === "NotFound" || statusCode === 404) {
        return false;
      }
      throw new RendererError("TEMPORARY_STORAGE_ERROR", `R2 objectExists error for key '${key}'`, err);
    }
  }

  /**
   * Deletes all objects matching prefix with full pagination support.
   */
  async deletePrefix(prefix: string): Promise<{ deletedCount: number }> {
    if (!prefix || prefix.trim().length === 0) {
      throw new RendererError("VALIDATION_FAILURE", "Cannot delete empty prefix");
    }

    let deletedCount = 0;
    let continuationToken: string | undefined;

    do {
      let listResponse;
      try {
        listResponse = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        );
      } catch (err) {
        throw new RendererError("TEMPORARY_STORAGE_ERROR", `R2 ListObjects error for prefix '${prefix}'`, err);
      }

      const contents = listResponse.Contents || [];
      const keysToDelete = contents.map((o) => ({ Key: o.Key! })).filter((o) => !!o.Key);

      if (keysToDelete.length > 0) {
        try {
          await this.client.send(
            new DeleteObjectsCommand({
              Bucket: this.bucketName,
              Delete: {
                Objects: keysToDelete,
                Quiet: true,
              },
            })
          );
          deletedCount += keysToDelete.length;
        } catch (err) {
          throw new RendererError(
            "TEMPORARY_STORAGE_ERROR",
            `R2 DeleteObjects error for prefix '${prefix}'`,
            err
          );
        }
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    return { deletedCount };
  }

  /**
   * Helper to count existing objects under prefix (for post-cleanup verification).
   */
  async countPrefix(prefix: string): Promise<number> {
    let count = 0;
    let continuationToken: string | undefined;

    do {
      const listResponse = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      count += (listResponse.Contents || []).length;
      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    return count;
  }
}
