import { readFile } from "node:fs/promises";
import { RendererError } from "../errors.js";

/**
 * Storage abstraction for derived full-view artifacts.
 * Decouples the orchestrator from specific cloud providers (Cloudflare R2, S3, local mock).
 */
export interface DerivedStorage {
  uploadFile(key: string, localFilePath: string, contentType: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  deletePrefix(prefix: string): Promise<{ deletedCount: number }>;
}

export interface StoredObject {
  bytes: Buffer;
  contentType: string;
  uploadedAt: Date;
}

/**
 * In-Memory Derived Storage implementation for deterministic, credential-free testing.
 */
export class InMemoryDerivedStorage implements DerivedStorage {
  private objects = new Map<string, StoredObject>();
  private failureMap = new Map<string, Error>();
  private globalUploadFailure: Error | null = null;

  async uploadFile(key: string, localFilePath: string, contentType: string): Promise<void> {
    if (this.globalUploadFailure) {
      throw this.globalUploadFailure;
    }
    if (this.failureMap.has(key)) {
      throw this.failureMap.get(key)!;
    }

    let bytes: Buffer;
    try {
      bytes = await readFile(localFilePath);
    } catch (err) {
      throw new RendererError("INVALID_SOURCE_PATH", `Cannot read local file for storage upload: ${localFilePath}`, err);
    }

    this.objects.set(key, {
      bytes,
      contentType,
      uploadedAt: new Date(),
    });
  }

  async objectExists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async deletePrefix(prefix: string): Promise<{ deletedCount: number }> {
    let deletedCount = 0;
    for (const key of Array.from(this.objects.keys())) {
      if (key.startsWith(prefix)) {
        this.objects.delete(key);
        deletedCount++;
      }
    }
    return { deletedCount };
  }

  // Testing helpers
  setFailOnKey(key: string, error: Error): void {
    this.failureMap.set(key, error);
  }

  setGlobalUploadFailure(error: Error | null): void {
    this.globalUploadFailure = error;
  }

  getAllKeys(): string[] {
    return Array.from(this.objects.keys());
  }

  getObject(key: string): StoredObject | undefined {
    return this.objects.get(key);
  }

  clear(): void {
    this.objects.clear();
    this.failureMap.clear();
    this.globalUploadFailure = null;
  }
}

