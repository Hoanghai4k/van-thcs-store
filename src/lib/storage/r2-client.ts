/**
 * Cloudflare R2 S3-compatible client — server-only.
 *
 * Uses @aws-sdk/client-s3 with R2 endpoint.
 * NEVER import this file in client components.
 *
 * Required env vars (all server-only, no NEXT_PUBLIC_ prefix):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 */

import { S3Client } from "@aws-sdk/client-s3";

let r2Client: S3Client | null = null;

/**
 * Get the singleton R2 S3 client.
 * Throws if R2 env vars are missing.
 */
export function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 client requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY. " +
        "These must be set in .env.local for server-side operations.",
    );
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return r2Client;
}

/**
 * Get the R2 bucket name from environment.
 * Throws if not configured.
 */
export function getR2BucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME is not configured.");
  }
  return bucket;
}
