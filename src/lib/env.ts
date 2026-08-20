/**
 * Environment variable validation.
 * Provides clear error messages when required env vars are missing.
 * Server-only variables must never be prefixed with NEXT_PUBLIC_.
 */

import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Production site URL (server-only, for payment return/cancel URLs)
  SITE_URL: z.string().url().optional(),
  // payOS Payment Provider (server-only, never exposed to browser)
  PAYOS_CLIENT_ID: z.string().min(1).optional(),
  PAYOS_API_KEY: z.string().min(1).optional(),
  PAYOS_CHECKSUM_KEY: z.string().min(1).optional(),
  // Email
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  ADMIN_SECRET_KEY: z.string().optional(),
  // Order access cookie signing secret (min 32 chars for production)
  ORDER_ACCESS_SECRET: z.string().min(32).optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validates and returns server-side environment variables.
 * Should only be called in server-side code.
 */
export function getServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "❌ Server environment variable validation failed:",
      result.error.flatten().fieldErrors,
    );
    throw new Error(
      "Missing or invalid server environment variables. Check .env.local against .env.example.",
    );
  }
  return result.data;
}

/**
 * Validates and returns client-side environment variables.
 * These variables are safe to expose in the browser bundle.
 */
export function getClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!result.success) {
    console.error(
      "❌ Client environment variable validation failed:",
      result.error.flatten().fieldErrors,
    );
    throw new Error(
      "Missing or invalid client environment variables. Check .env.local against .env.example.",
    );
  }
  return result.data;
}

/**
 * Check if Supabase is configured. Used to gracefully degrade
 * to mock data during development without Supabase credentials.
 */
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

/**
 * Check if payOS payment provider is configured.
 * All three credentials must be present.
 */
export function isPayOSConfigured(): boolean {
  return !!(
    process.env.PAYOS_CLIENT_ID &&
    process.env.PAYOS_API_KEY &&
    process.env.PAYOS_CHECKSUM_KEY
  );
}
