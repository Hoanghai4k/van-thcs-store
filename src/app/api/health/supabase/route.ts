/**
 * Supabase connection health check.
 *
 * GET /api/health/supabase
 *
 * Returns only safe status information. No internal errors,
 * schema names, or credentials are exposed in the response.
 *
 * Development-only — should be removed or protected before production.
 */

import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }

  try {
    const { getSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await getSupabaseServerClient();

    // Lightweight query to verify connectivity
    const { error } = await supabase.from("categories").select("id").limit(1);

    if (!error) {
      return NextResponse.json({ status: "ok" });
    }

    // Any error that proves the connection works (table not found, permission denied)
    // is still a successful connectivity check — schema just isn't set up yet
    const isConnectivityOk =
      error.message.includes("does not exist") ||
      error.message.includes("relation") ||
      error.message.includes("schema cache") ||
      error.message.includes("permission denied");

    if (isConnectivityOk) {
      // Log detail server-side only
      console.log(`[Health] Supabase connected but schema incomplete: ${error.message}`);
      return NextResponse.json({ status: "ok" });
    }

    // Unexpected error — log server-side, return generic status
    console.error("[Health] Supabase unexpected error:", error.message);
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  } catch (err) {
    console.error("[Health] Supabase connection failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
