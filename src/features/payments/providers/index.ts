/**
 * Payment providers registry.
 *
 * Lazily initializes the configured payment provider.
 * Currently supports payOS; future providers (MoMo, VNPAY)
 * can be added here without changing business logic.
 */

import type { PaymentProvider } from "../payment-provider";
import { PayOSPaymentProvider } from "./payos";
import { isPayOSConfigured } from "@/lib/env";

let cachedProvider: PaymentProvider | null = null;

/**
 * Get the configured payment provider.
 * Returns null if no provider is configured (graceful degradation).
 */
export function getPaymentProvider(): PaymentProvider | null {
  if (cachedProvider) return cachedProvider;

  if (isPayOSConfigured()) {
    cachedProvider = new PayOSPaymentProvider({
      clientId: process.env.PAYOS_CLIENT_ID!,
      apiKey: process.env.PAYOS_API_KEY!,
      checksumKey: process.env.PAYOS_CHECKSUM_KEY!,
    });
    return cachedProvider;
  }

  // No provider configured
  return null;
}

/**
 * Get the payment provider or throw.
 * Use when payment is required (e.g., checkout).
 */
export function requirePaymentProvider(): PaymentProvider {
  const provider = getPaymentProvider();
  if (!provider) {
    throw new Error(
      "Payment provider chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
    );
  }
  return provider;
}
