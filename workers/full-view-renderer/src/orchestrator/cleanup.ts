import type { DerivedStorage } from "./derived-storage.js";

export interface CleanupResult {
  attempted: boolean;
  success: boolean;
  deletedCount: number;
  error?: Error;
}

/**
 * Attempts to remove orphaned or partially uploaded derived objects from storage.
 * Invariant: Storage cleanup failure must NEVER mask or overwrite the primary rendering/upload failure.
 */
export async function cleanupFailedStoragePrefix(
  storage: DerivedStorage,
  storagePrefix: string
): Promise<CleanupResult> {
  if (!storagePrefix || storagePrefix.trim().length === 0) {
    return { attempted: false, success: true, deletedCount: 0 };
  }

  try {
    const res = await storage.deletePrefix(storagePrefix);
    return {
      attempted: true,
      success: true,
      deletedCount: res.deletedCount,
    };
  } catch (err) {
    // Log cleanup failure separately without throwing
    const cleanupError = err instanceof Error ? err : new Error(String(err));
    return {
      attempted: true,
      success: false,
      deletedCount: 0,
      error: cleanupError,
    };
  }
}
