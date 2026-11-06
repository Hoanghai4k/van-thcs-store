import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { verifyProductEntitlement } from "@/features/account/library-queries";
import { checkProductsArtifactReadiness } from "@/features/viewer/viewer-service";

export interface ProductAccessState {
  isAuthenticated: boolean;
  isEntitled: boolean;
  viewerReady: boolean;
}

/**
 * Shared server-side access state resolver for products.
 *
 * Used by:
 * - /xem-thu/[slug] (Preview Landing)
 * - /products/[slug] (Product Detail)
 *
 * STRICT SECURITY CONSTRAINTS:
 * - Runs strictly server-side.
 * - Authenticated session determines user (never client params).
 * - Row Level Security verifies entitlements.
 * - Service-role check for viewer readiness runs ONLY after entitlement is verified.
 */
export async function getProductAccessState(
  productIdOrSlug: string,
  client?: SupabaseClient<Database>,
): Promise<ProductAccessState> {
  try {
    const supabase = client ?? (await getSupabaseServerClient());
    const entitlement = await verifyProductEntitlement(productIdOrSlug, supabase);

    if (!entitlement.entitled) {
      return {
        isAuthenticated: entitlement.reason !== "UNAUTHENTICATED",
        isEntitled: false,
        viewerReady: false,
      };
    }

    // Customer is verified to have an active entitlement (PAID or BONUS)
    let viewerReady = false;
    try {
      const readySet = await checkProductsArtifactReadiness([entitlement.product.id]);
      viewerReady = readySet.has(entitlement.product.id);
    } catch {
      // If service-role lookup fails or is unconfigured (e.g. test environment),
      // preserve verified entitlement rather than falsely denying access.
      viewerReady = false;
    }

    return {
      isAuthenticated: true,
      isEntitled: true,
      viewerReady,
    };
  } catch {
    return {
      isAuthenticated: false,
      isEntitled: false,
      viewerReady: false,
    };
  }
}
