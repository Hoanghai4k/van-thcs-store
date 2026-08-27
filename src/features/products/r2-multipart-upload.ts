/**
 * Client-side R2 multipart upload orchestrator.
 *
 * Flow:
 *   1. POST /api/admin/upload/init → sessionToken, objectKey, partCount, partSize
 *   2. For each part:
 *      a. POST /api/admin/upload/sign-part → presignedUrl
 *      b. PUT presignedUrl with file.slice() → ETag from response
 *   3. POST /api/admin/upload/complete with all ETags → file record
 *
 * File binary goes Browser → R2 directly (never through Vercel).
 * Only metadata/signing flows through Next.js API routes.
 *
 * Features:
 * - Configurable concurrency (default: 3)
 * - Per-part retry with exponential backoff
 * - Cancel support via AbortController
 * - Progress callbacks
 */

import { R2_UPLOAD_CONCURRENCY } from "@/lib/constants";
// ─── Types ────────────────────────────────────────────────────────

export interface R2UploadCallbacks {
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  onSuccess?: (fileRecord: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
}

export interface R2UploadHandle {
  /** Start the upload process */
  start: () => void;
  /** Abort the upload — cleans up R2 multipart session */
  abort: () => Promise<void>;
}

export interface R2UploadResult {
  success: boolean;
  error?: string;
  handle?: R2UploadHandle;
  isLargeFile?: boolean;
}

interface InitResponse {
  sessionToken: string;
  objectKey: string;
  uploadId: string;
  partCount: number;
  partSize: number;
  error?: string;
}

interface PartResult {
  partNumber: number;
  etag: string;
}

// ─── Retry Configuration ─────────────────────────────────────────

const MAX_RETRIES = 4;
const RETRY_DELAYS_MS = [0, 3000, 5000, 10000, 20000];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main Upload Function ─────────────────────────────────────────

/**
 * Prepare an R2 multipart upload.
 *
 * Returns a handle with start() and abort() methods.
 * Call start() to begin the upload process.
 */
export async function prepareR2Upload(
  productId: string,
  file: File,
  callbacks: R2UploadCallbacks,
): Promise<R2UploadResult> {
  const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024; // 500 MB
  const isLargeFile = file.size > LARGE_FILE_THRESHOLD;

  // 1. Init multipart upload
  let initData: InitResponse;
  try {
    const initRes = await fetch("/api/admin/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
      }),
    });

    if (!initRes.ok) {
      const errBody = await initRes.json().catch(() => ({}));
      return {
        success: false,
        error: (errBody as { error?: string }).error ?? `Lỗi khởi tạo: HTTP ${initRes.status}`,
      };
    }

    initData = await initRes.json();
  } catch (err) {
    return {
      success: false,
      error: `Lỗi kết nối khi khởi tạo tải lên: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }

  // 2. Build handle
  const abortController = new AbortController();
  const sessionToken = initData.sessionToken;
  let aborted = false;

  const handle: R2UploadHandle = {
    start: () => {
      executeUpload(
        file,
        initData,
        sessionToken,
        abortController,
        callbacks,
        () => aborted,
      );
    },
    abort: async () => {
      aborted = true;
      abortController.abort();
      // Best-effort abort on R2
      try {
        await fetch("/api/admin/upload/abort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken }),
        });
      } catch {
        // Ignore — upload may already be completed
      }
    },
  };

  return { success: true, handle, isLargeFile };
}

// ─── Upload Execution ─────────────────────────────────────────────

async function executeUpload(
  file: File,
  initData: InitResponse,
  sessionToken: string,
  abortController: AbortController,
  callbacks: R2UploadCallbacks,
  isAborted: () => boolean,
): Promise<void> {
  const { partCount, partSize } = initData;
  const completedParts: PartResult[] = [];
  let totalBytesUploaded = 0;

  try {
    // Upload parts with controlled concurrency
    const partQueue: number[] = [];
    for (let i = 1; i <= partCount; i++) {
      partQueue.push(i);
    }

    // Process parts in batches of R2_UPLOAD_CONCURRENCY
    let queueIndex = 0;
    while (queueIndex < partQueue.length) {
      if (isAborted()) return;

      const batch = partQueue.slice(queueIndex, queueIndex + R2_UPLOAD_CONCURRENCY);
      queueIndex += R2_UPLOAD_CONCURRENCY;

      const results = await Promise.all(
        batch.map((partNumber) =>
          uploadSinglePart(
            file,
            partNumber,
            partSize,
            partCount,
            sessionToken,
            abortController.signal,
          ),
        ),
      );

      for (const result of results) {
        if (isAborted()) return;
        completedParts.push(result);
        totalBytesUploaded += getPartSize(file.size, result.partNumber, partSize, partCount);
        callbacks.onProgress?.(totalBytesUploaded, file.size);
      }
    }

    if (isAborted()) return;

    // Complete multipart upload
    const completeRes = await fetch("/api/admin/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionToken,
        parts: completedParts,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      }),
      signal: abortController.signal,
    });

    if (!completeRes.ok) {
      const errBody = await completeRes.json().catch(() => ({}));
      throw new Error(
        (errBody as { error?: string }).error ?? `Lỗi hoàn tất: HTTP ${completeRes.status}`,
      );
    }

    const completeData = await completeRes.json();
    callbacks.onSuccess?.(completeData.file);
  } catch (err) {
    if (isAborted()) return;
    const error =
      err instanceof Error ? err : new Error("Lỗi không xác định khi tải lên.");
    callbacks.onError?.(error);
  }
}

// ─── Single Part Upload with Retry ────────────────────────────────

async function uploadSinglePart(
  file: File,
  partNumber: number,
  partSize: number,
  totalParts: number,
  sessionToken: string,
  signal: AbortSignal,
): Promise<PartResult> {
  // Calculate byte range for this part
  const start = (partNumber - 1) * partSize;
  const end = partNumber === totalParts ? file.size : start + partSize;
  const partBlob = file.slice(start, end);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal.aborted) throw new Error("Upload cancelled");

    try {
      // 1. Get presigned URL
      const signRes = await fetch("/api/admin/upload/sign-part", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, partNumber }),
        signal,
      });

      if (!signRes.ok) {
        throw new Error(`Sign-part failed: HTTP ${signRes.status}`);
      }

      const { presignedUrl } = await signRes.json();

      // 2. Upload part directly to R2
      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        body: partBlob,
        signal,
      });

      if (!uploadRes.ok) {
        throw new Error(`Part upload failed: HTTP ${uploadRes.status}`);
      }

      const etag = uploadRes.headers.get("etag");
      if (!etag) {
        throw new Error("R2 did not return ETag for part");
      }

      return { partNumber, etag };
    } catch (err) {
      if (signal.aborted) throw new Error("Upload cancelled");

      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Phần ${partNumber} thất bại sau ${MAX_RETRIES + 1} lần thử: ${err instanceof Error ? err.message : "Unknown"}`,
        );
      }

      // Retry with backoff
      const delay = RETRY_DELAYS_MS[attempt + 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      console.warn(`[R2Upload] Part ${partNumber} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // Unreachable but TypeScript needs it
  throw new Error(`Part ${partNumber} failed`);
}

// ─── Helpers ─────────────────────────────────────────────────────

function getPartSize(
  totalFileSize: number,
  partNumber: number,
  partSize: number,
  totalParts: number,
): number {
  if (partNumber === totalParts) {
    return totalFileSize - (totalParts - 1) * partSize;
  }
  return partSize;
}
