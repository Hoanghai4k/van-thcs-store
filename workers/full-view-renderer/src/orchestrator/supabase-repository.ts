import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RendererError } from "../errors.js";
import type { DocumentManifestEntry } from "../types.js";
import type { ArtifactRepository } from "./artifact-repository.js";
import type {
  ArtifactStatus,
  DocumentViewArtifactRecord,
  StorageProvider,
} from "./types.js";

export interface SupabaseArtifactRepositoryOptions {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

/**
 * Production Supabase Artifact Repository implementation.
 *
 * CRITICAL SECURITY CONSTRAINTS:
 * - SERVER-ONLY / WORKER-ONLY: NEVER import or expose to client/browser components.
 * - Uses service_role exclusively inside trusted background workers.
 * - Scoped operations: Deletions are strictly constrained to exact row IDs.
 * - Concurrency Hardening: Implements atomic conditional claim during markProcessing.
 */
export class SupabaseArtifactRepository implements ArtifactRepository {
  private client: SupabaseClient;

  constructor(options: SupabaseArtifactRepositoryOptions | { client: SupabaseClient }) {
    if ("client" in options) {
      this.client = options.client;
    } else {
      if (!options.supabaseUrl || !options.supabaseServiceRoleKey) {
        throw new RendererError(
          "VALIDATION_FAILURE",
          "SupabaseArtifactRepository requires valid supabaseUrl and supabaseServiceRoleKey"
        );
      }
      this.client = createClient(options.supabaseUrl, options.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  }

  async findVersion(
    productFileId: string,
    sourceSha256: string,
    rendererVersion: string
  ): Promise<DocumentViewArtifactRecord | null> {
    const { data, error } = await this.client
      .from("document_view_artifacts")
      .select("*")
      .eq("product_file_id", productFileId)
      .eq("source_sha256", sourceSha256.toLowerCase())
      .eq("renderer_version", rendererVersion.trim())
      .maybeSingle();

    if (error) {
      throw new RendererError("RENDER_FAILURE", `Supabase findVersion error: ${error.message}`, error);
    }

    return data as DocumentViewArtifactRecord | null;
  }

  async createPending(params: {
    productFileId: string;
    sourceSha256: string;
    rendererVersion: string;
    storageProvider: StorageProvider;
    storagePrefix: string;
  }): Promise<DocumentViewArtifactRecord> {
    const { data, error } = await this.client
      .from("document_view_artifacts")
      .insert({
        product_file_id: params.productFileId,
        source_sha256: params.sourceSha256.toLowerCase(),
        renderer_version: params.rendererVersion.trim(),
        status: "PENDING",
        storage_provider: params.storageProvider,
        storage_prefix: params.storagePrefix,
        page_count: null,
        document_manifest: [],
        error_code: null,
        error_message: null,
      })
      .select()
      .single();

    if (error) {
      throw new RendererError("RENDER_FAILURE", `Supabase createPending error: ${error.message}`, error);
    }

    return data as DocumentViewArtifactRecord;
  }

  /**
   * Concurrency Hardening: Minimum production-safe atomic claim.
   *
   * Conceptually equivalent to:
   * UPDATE document_view_artifacts
   * SET status = 'PROCESSING', updated_at = now()
   * WHERE id = :id AND status IN ('PENDING', 'FAILED_RETRYABLE')
   * RETURNING *
   */
  async markProcessing(id: string): Promise<DocumentViewArtifactRecord> {
    const { data, error } = await this.client
      .from("document_view_artifacts")
      .update({
        status: "PROCESSING",
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .in("status", ["PENDING", "FAILED_RETRYABLE"])
      .select()
      .maybeSingle();

    if (error) {
      throw new RendererError("RENDER_FAILURE", `Supabase markProcessing error: ${error.message}`, error);
    }

    if (!data) {
      throw new RendererError(
        "RENDER_FAILURE",
        `Atomic claim failed for artifact id '${id}': row is not in PENDING or FAILED_RETRYABLE state, or another worker claimed it.`
      );
    }

    return data as DocumentViewArtifactRecord;
  }

  async markReady(
    id: string,
    params: {
      pageCount: number;
      documentManifest: DocumentManifestEntry[];
      storagePrefix: string;
    }
  ): Promise<DocumentViewArtifactRecord> {
    const { data, error } = await this.client
      .from("document_view_artifacts")
      .update({
        status: "READY",
        page_count: params.pageCount,
        document_manifest: params.documentManifest,
        storage_prefix: params.storagePrefix,
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new RendererError("RENDER_FAILURE", `Supabase markReady error: ${error.message}`, error);
    }

    return data as DocumentViewArtifactRecord;
  }

  async markFailure(
    id: string,
    params: {
      status: "FAILED_RETRYABLE" | "FAILED_FINAL";
      errorCode: string;
      errorMessage: string;
    }
  ): Promise<DocumentViewArtifactRecord> {
    const { data, error } = await this.client
      .from("document_view_artifacts")
      .update({
        status: params.status,
        error_code: params.errorCode,
        error_message: params.errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new RendererError("RENDER_FAILURE", `Supabase markFailure error: ${error.message}`, error);
    }

    return data as DocumentViewArtifactRecord;
  }

  /**
   * Strictly scoped deletion for smoke tests and quarantine cleanup.
   * NEVER permits broad deletes.
   */
  async deleteExactRow(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("document_view_artifacts")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      throw new RendererError("RENDER_FAILURE", `Supabase deleteExactRow error: ${error.message}`, error);
    }

    return Array.isArray(data) && data.length > 0;
  }

  /**
   * Safe count query for pre-test and post-test verification.
   */
  async countArtifacts(): Promise<number> {
    const { count, error } = await this.client
      .from("document_view_artifacts")
      .select("*", { count: "exact", head: true });

    if (error) {
      throw new RendererError("RENDER_FAILURE", `Supabase countArtifacts error: ${error.message}`, error);
    }

    return count ?? 0;
  }
}
