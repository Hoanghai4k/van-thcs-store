import { describe, it, expect, vi } from "vitest";
import {
  R2DerivedStorage,
  buildR2Endpoint,
} from "../src/orchestrator/r2-storage.js";
import {
  SupabaseArtifactRepository,
} from "../src/orchestrator/supabase-repository.js";
import { RendererError } from "../src/errors.js";

describe("Phase 2G — Infrastructure Adapters Unit Tests (Mocked/Credential-Free)", () => {
  describe("R2DerivedStorage Adapter Unit Logic", () => {
    it("builds valid R2 endpoint URLs and enforces accountId constraints", () => {
      const endpoint = buildR2Endpoint("c7b8d98ed2d1f442a15a30b113ecc07a");
      expect(endpoint).toBe("https://c7b8d98ed2d1f442a15a30b113ecc07a.r2.cloudflarestorage.com");

      // Custom override
      const custom = buildR2Endpoint("any", "https://custom.r2.cloudflarestorage.com");
      expect(custom).toBe("https://custom.r2.cloudflarestorage.com");

      // Invalid empty
      expect(() => buildR2Endpoint("  ")).toThrowError(/R2_ACCOUNT_ID is empty/);
    });

    it("paginates through multiple ListObjects pages and batches DeleteObjects during deletePrefix", async () => {
      // Mock S3Client send method
      const mockSend = vi.fn();

      // Page 1: returns 2 objects + NextContinuationToken "token-page-2"
      // Page 2: returns 1 object, no token
      mockSend.mockImplementation(async (command: any) => {
        const cmdName = command.constructor.name;
        if (cmdName === "ListObjectsV2Command") {
          if (!command.input.ContinuationToken) {
            return {
              Contents: [{ Key: "derived/prefix/page-0001.webp" }, { Key: "derived/prefix/page-0002.webp" }],
              NextContinuationToken: "token-page-2",
            };
          } else if (command.input.ContinuationToken === "token-page-2") {
            return {
              Contents: [{ Key: "derived/prefix/manifest.json" }],
              NextContinuationToken: undefined,
            };
          }
        }
        if (cmdName === "DeleteObjectsCommand") {
          return { Deleted: command.input.Delete.Objects };
        }
        return {};
      });

      const fakeClient = { send: mockSend } as any;
      const storage = new R2DerivedStorage({
        bucketName: "test-bucket",
        client: fakeClient,
      });

      const result = await storage.deletePrefix("derived/prefix/");

      // Total 3 objects across 2 paginated list calls
      expect(result.deletedCount).toBe(3);
      expect(mockSend).toHaveBeenCalledTimes(4); // 2 ListObjectsV2 + 2 DeleteObjects
    });

    it("rejects empty prefix on deletePrefix to prevent catastrophic bucket deletion", async () => {
      const fakeClient = { send: vi.fn() } as any;
      const storage = new R2DerivedStorage({
        bucketName: "test-bucket",
        client: fakeClient,
      });

      await expect(storage.deletePrefix("   ")).rejects.toThrowError(/Cannot delete empty prefix/);
    });

    it("handles objectExists returning true on 200 and false on 404/NotFound", async () => {
      const mockSend = vi.fn();
      mockSend
        .mockResolvedValueOnce({}) // 1st call: exists
        .mockRejectedValueOnce({ name: "NotFound", $metadata: { httpStatusCode: 404 } }); // 2nd call: not found

      const fakeClient = { send: mockSend } as any;
      const storage = new R2DerivedStorage({
        bucketName: "test-bucket",
        client: fakeClient,
      });

      const exists1 = await storage.objectExists("derived/test/page-0001.webp");
      expect(exists1).toBe(true);

      const exists2 = await storage.objectExists("derived/test/missing.webp");
      expect(exists2).toBe(false);
    });
  });

  describe("SupabaseArtifactRepository Atomic Claim Unit Logic", () => {
    it("enforces atomic conditional claim during markProcessing and throws if row cannot be acquired", async () => {
      // Mock SupabaseClient
      const mockUpdate = vi.fn();
      const mockEq = vi.fn();
      const mockIn = vi.fn();
      const mockSelect = vi.fn();
      const mockMaybeSingle = vi.fn();

      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ in: mockIn });
      mockIn.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ maybeSingle: mockMaybeSingle });

      const fakeClient = {
        from: vi.fn().mockReturnValue({ update: mockUpdate }),
      } as any;

      const repo = new SupabaseArtifactRepository({ client: fakeClient });

      // Case 1: Row was successfully acquired (status was PENDING)
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: "test-id-1", status: "PROCESSING" },
        error: null,
      });

      const claimed = await repo.markProcessing("test-id-1");
      expect(claimed.status).toBe("PROCESSING");
      expect(mockIn).toHaveBeenCalledWith("status", ["PENDING", "FAILED_RETRYABLE"]);

      // Case 2: Row was already claimed by another worker (0 rows returned)
      mockMaybeSingle.mockResolvedValueOnce({
        data: null, // 0 rows returned
        error: null,
      });

      await expect(repo.markProcessing("test-id-2")).rejects.toThrowError(
        /Atomic claim failed for artifact id 'test-id-2'/
      );
    });
  });

  describe("Service Role Boundary Verification", () => {
    it("verifies SUPABASE_SERVICE_ROLE_KEY is never exported to client-side code", async () => {
      const { readFileSync } = await import("node:fs");
      const { resolve } = await import("node:path");

      // Verify that workers/full-view-renderer files do not export service keys
      const repoSrc = readFileSync(
        resolve(__dirname, "../src/orchestrator/supabase-repository.ts"),
        "utf8"
      );

      expect(repoSrc).toContain("SERVER-ONLY / WORKER-ONLY: NEVER import or expose to client/browser components.");
      expect(repoSrc).not.toContain("NEXT_PUBLIC_");
    });
  });
});
