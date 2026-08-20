/**
 * Webhook handler tests.
 *
 * Tests the core handleVerifiedPaymentEvent function
 * with mocked Supabase client. No real DB or provider calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleVerifiedPaymentEvent } from "@/features/payments/webhook-handler";
import type { VerifiedPaymentEvent } from "@/features/payments/types";

// Mock Supabase client
function createMockSupabase(orderData: Record<string, unknown> | null = null, updateError: Error | null = null, attemptData: Record<string, unknown> | null = null) {
  return {
    from: vi.fn((table: string) => {
      const isOrders = table === "orders";
      const eqChain: Record<string, unknown> = {
        eq: () => eqChain,
        single: vi.fn().mockResolvedValue({
          data: isOrders ? orderData : attemptData,
          error: (isOrders ? orderData : attemptData) ? null : { message: "Not found" },
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: isOrders ? orderData : attemptData,
          error: null, // maybeSingle doesn't throw if not found
        }),
      };
      return {
        select: vi.fn().mockReturnValue(eqChain),
        update: vi.fn().mockReturnValue(eqChain),
      };
    }),
  } as unknown as Parameters<typeof handleVerifiedPaymentEvent>[1];
}

describe("handleVerifiedPaymentEvent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid events", async () => {
    const supabase = createMockSupabase();
    const event: VerifiedPaymentEvent = { valid: false };
    const result = await handleVerifiedPaymentEvent(event, supabase);

    expect(result.success).toBe(false);
    expect(result.action).toBe("rejected");
    expect(result.reason).toBe("Invalid event");
  });

  it("rejects events without provider order code", async () => {
    const supabase = createMockSupabase();
    const event: VerifiedPaymentEvent = { valid: true, provider: "payos" };
    const result = await handleVerifiedPaymentEvent(event, supabase);

    expect(result.success).toBe(false);
    expect(result.action).toBe("rejected");
    expect(result.reason).toBe("Missing provider order code");
  });

  it("returns unknown_order for valid sig but no matching order (registration probe)", async () => {
    const supabase = createMockSupabase(null);
    const event: VerifiedPaymentEvent = {
      valid: true,
      provider: "payos",
      providerOrderCode: 123456,
      amount: 100000,
      status: "success",
    };
    const result = await handleVerifiedPaymentEvent(event, supabase);

    expect(result.success).toBe(false);
    expect(result.action).toBe("rejected");
    expect(result.reason).toBe("unknown_order");
  });

  it("rejects amount mismatch", async () => {
    const supabase = createMockSupabase({
      id: "order-1",
      order_code: "VTS-20260819-ABC12",
      total_amount: 100000,
      status: "PENDING",
      paid_at: null,
      payment_transaction_id: null,
    });
    const event: VerifiedPaymentEvent = {
      valid: true,
      provider: "payos",
      providerOrderCode: 123456,
      amount: 50000, // MISMATCH
      status: "success",
    };
    const result = await handleVerifiedPaymentEvent(event, supabase);

    expect(result.success).toBe(false);
    expect(result.action).toBe("rejected");
    expect(result.reason).toContain("Amount mismatch");
  });

  it("handles duplicate PAID webhook idempotently", async () => {
    const supabase = createMockSupabase({
      id: "order-1",
      order_code: "VTS-20260819-ABC12",
      total_amount: 100000,
      status: "PAID", // Already paid
      paid_at: "2026-08-19T10:00:00Z",
      payment_transaction_id: "txn-123",
    });
    const event: VerifiedPaymentEvent = {
      valid: true,
      provider: "payos",
      providerOrderCode: 123456,
      amount: 100000,
      status: "success",
    };
    const result = await handleVerifiedPaymentEvent(event, supabase);

    expect(result.success).toBe(true);
    expect(result.action).toBe("already_processed");
  });

  it("rejects invalid state transition (CANCELLED → PAID)", async () => {
    const supabase = createMockSupabase({
      id: "order-1",
      order_code: "VTS-20260819-ABC12",
      total_amount: 100000,
      status: "CANCELLED",
      paid_at: null,
      payment_transaction_id: null,
    });
    const event: VerifiedPaymentEvent = {
      valid: true,
      provider: "payos",
      providerOrderCode: 123456,
      amount: 100000,
      status: "success",
    };
    const result = await handleVerifiedPaymentEvent(event, supabase);

    expect(result.success).toBe(false);
    expect(result.action).toBe("rejected");
    expect(result.reason).toContain("Invalid transition");
  });

  it("rejects unknown provider status", async () => {
    const supabase = createMockSupabase({
      id: "order-1",
      order_code: "VTS-20260819-ABC12",
      total_amount: 100000,
      status: "PENDING",
      paid_at: null,
      payment_transaction_id: null,
    });
    const event: VerifiedPaymentEvent = {
      valid: true,
      provider: "payos",
      providerOrderCode: 123456,
      amount: 100000,
      status: undefined, // Unknown status
    };
    const result = await handleVerifiedPaymentEvent(event, supabase);

    expect(result.success).toBe(false);
    expect(result.action).toBe("rejected");
    expect(result.reason).toContain("Unknown provider status");
  });
  it("registration probe with unknown order does not mutate database", async () => {
    // A payOS registration probe sends a valid-signature event with a sample orderCode.
    // The handler must NOT create orders, NOT update anything — just acknowledge.
    const supabase = createMockSupabase(null);
    const event: VerifiedPaymentEvent = {
      valid: true,
      provider: "payos",
      providerOrderCode: 999999,
      amount: 1,
      status: "success",
    };
    const result = await handleVerifiedPaymentEvent(event, supabase);

    // Should NOT have called update
    expect(result.reason).toBe("unknown_order");
    expect(result.orderId).toBeUndefined();
  });

  it("amount mismatch does not mutate database", async () => {
    const supabase = createMockSupabase({
      id: "order-1",
      order_code: "VTS-20260819-ABC12",
      total_amount: 100000,
      status: "PENDING",
      paid_at: null,
      payment_transaction_id: null,
    });
    const event: VerifiedPaymentEvent = {
      valid: true,
      provider: "payos",
      providerOrderCode: 123456,
      amount: 50000, // MISMATCH
      status: "success",
    };
    const result = await handleVerifiedPaymentEvent(event, supabase);

    expect(result.success).toBe(false);
    expect(result.reason).toContain("Amount mismatch");
    // Order should remain PENDING — no status change
    expect(result.action).toBe("rejected");
  });
});
