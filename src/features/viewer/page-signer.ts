/**
 * R2 Presigned URL Generator for Secure Document Pages.
 *
 * Server-only helper. Issues short-lived GET URLs for private R2 page objects.
 * URLs are NOT single-use but expire quickly (default 60 seconds).
 */

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2BucketName } from "@/lib/storage/r2-client";
import { PRESIGNED_URL_EXPIRES_IN_SECONDS } from "./constants";

export async function generatePagePresignedUrl(
  objectKey: string,
  expiresInSeconds: number = PRESIGNED_URL_EXPIRES_IN_SECONDS,
): Promise<string> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

